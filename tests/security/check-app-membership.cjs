/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused privacy/authorization regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const actor = '11111111-1111-4111-8111-111111111111';
const writes = [];
const loaded = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/app/(app)/membership/actions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: loaded,
    require(name) {
      const dependencies = {
        'next/cache': { revalidatePath: () => {} },
        zod: require('zod'),
        '@/lib/hearth/context': {
          getViewer: async () => ({
            user: { id: actor },
            supabase: {
              from: () => ({
                upsert: async (row) => {
                  writes.push(row);
                  return { error: null };
                },
              }),
            },
          }),
        },
      };
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  },
);

(async () => {
  const form = new FormData();
  form.set('visible', 'true');
  form.set('alias', 'Wren');
  form.set('profile_id', '22222222-2222-4222-8222-222222222222');
  let result = await loaded.updateDirectoryPreference({}, form);
  assert.equal(result.error, null);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].profile_id, actor);
  assert.equal(writes[0].alias, 'Wren');
  assert.equal(writes[0].visible_to_owner, true);

  form.set('alias', 'name@example.com');
  result = await loaded.updateDirectoryPreference({}, form);
  assert.ok(result.error);
  assert.equal(writes.length, 1);

  form.set('visible', 'false');
  result = await loaded.updateDirectoryPreference({}, form);
  assert.equal(result.error, null);
  assert.equal(writes[1].profile_id, actor);
  assert.equal(writes[1].alias, null);
  assert.equal(writes[1].visible_to_owner, false);

  const migration = fs.readFileSync(
    'supabase/migrations/20260929003157_app_member_directory_preferences.sql',
    'utf8',
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /profile_id = \(select auth\.uid\(\)\)/);
  assert.match(
    migration,
    /revoke all on public\.app_member_directory_preferences from anon, authenticated/,
  );
  const page = fs.readFileSync('src/app/(app)/membership/page.tsx', 'utf8');
  assert.match(page, /serverEnv\.APP_OWNER_PROFILE_ID === user\.id/);
  assert.match(page, /\.select\('id, created_at'/);
  assert.doesNotMatch(page, /auth\.users|\.select\([^\n]*email/);
  console.log('App membership privacy checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
