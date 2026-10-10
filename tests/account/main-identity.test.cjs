/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Local owner projection regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const owner = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const other = '00000000-0000-4000-8000-000000000003';
const mainId = '00000000-0000-4000-8000-000000000004';
const otherMainId = '00000000-0000-4000-8000-000000000005';
const rows = {
  app_main_identity_acknowledgments: [{ profile_id: member, policy_version: '2026-10' }],
  characters: [
    {
      id: mainId,
      profile_id: member,
      character_name: 'Wrenx',
      realm_slug: 'stormrage',
      region: 'us',
      is_main: true,
    },
    {
      id: otherMainId,
      profile_id: other,
      character_name: 'Other',
      realm_slug: 'stormrage',
      region: 'us',
      is_main: true,
    },
  ],
  wow_character_claims: [
    {
      character_id: mainId,
      profile_id: member,
      character_name: 'wrenx',
      realm_slug: 'stormrage',
      region: 'us',
    },
    {
      character_id: otherMainId,
      profile_id: other,
      character_name: 'other',
      realm_slug: 'stormrage',
      region: 'us',
    },
  ],
};
let adminCalls = 0;
function createAdminClient() {
  adminCalls++;
  return {
    from(table) {
      const filters = [];
      const query = {
        select() {
          return query;
        },
        eq(field, value) {
          filters.push((row) => row[field] === value);
          return query;
        },
        in(field, values) {
          filters.push((row) => values.includes(row[field]));
          return query;
        },
        then(resolve) {
          return resolve({
            data: rows[table].filter((row) => filters.every((filter) => filter(row))),
            error: null,
          });
        },
      };
      return query;
    },
  };
}

const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/owner-main-identities.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: exportsObject,
    require(id) {
      if (id === '@/lib/env.server') return { serverEnv: { APP_OWNER_PROFILE_ID: owner } };
      if (id === '@/lib/supabase/admin') return { createAdminClient };
      return require(id);
    },
  },
);

(async () => {
  await assert.rejects(exportsObject.ownerMainIdentities(other, [member]), /Owner access required/);
  assert.equal(adminCalls, 0);
  let labels = await exportsObject.ownerMainIdentities(owner, [member, other]);
  assert.equal(labels.get(member), 'Wrenx · stormrage (US)');
  assert.equal(labels.has(other), false, 'an unacknowledged Main must stay hidden');
  rows.app_main_identity_acknowledgments = [];
  labels = await exportsObject.ownerMainIdentities(owner, [member]);
  assert.equal(labels.has(member), false, 'a previous nickname opt-in is not this acknowledgment');
  rows.app_main_identity_acknowledgments = [{ profile_id: member, policy_version: '2026-10' }];
  rows.wow_character_claims = [];
  labels = await exportsObject.ownerMainIdentities(owner, [member]);
  assert.equal(
    labels.has(member),
    false,
    'a Main without matching Battle.net proof must stay hidden',
  );
  const ownerPage = fs.readFileSync('src/app/(app)/owner/accounts/page.tsx', 'utf8');
  assert.doesNotMatch(
    ownerPage,
    /app_account_logins|Sign-in email:|app_member_directory_preferences/,
  );
  console.log('Owner Main labels require owner gate, acknowledgment, and matching proof.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
