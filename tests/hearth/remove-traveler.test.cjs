/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused action regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const owner = '11111111-1111-4111-8111-111111111111';
const traveler = '22222222-2222-4222-8222-222222222222';
let user = { id: owner },
  rpcError = null,
  returned = traveler;
const calls = [],
  revalidated = [];
const dependencies = {
  'next/cache': { revalidatePath: (...args) => revalidated.push(args) },
  'next/navigation': {
    redirect: (url) => {
      throw new Error(`REDIRECT:${url}`);
    },
  },
  zod: require('zod'),
  '@/lib/raiderio': {},
  '@/lib/supabase/admin': {},
  '@/lib/supabase/server': {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: returned, error: rpcError };
      },
    }),
  },
};
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/app/(app)/travelers/[id]/actions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: exportsObject,
    require: (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  },
);

(async () => {
  const form = new FormData();
  form.set('characterId', traveler);
  assert.ok((await exportsObject.removeTraveler({}, form)).error);
  assert.equal(calls.length, 0);
  form.set('confirm', 'on');
  user = null;
  assert.ok((await exportsObject.removeTraveler({}, form)).error);
  assert.equal(calls.length, 0);
  user = { id: owner };
  rpcError = { code: '42501' };
  assert.ok((await exportsObject.removeTraveler({}, form)).error);
  assert.equal(revalidated.length, 0);
  rpcError = null;
  returned = owner;
  assert.ok((await exportsObject.removeTraveler({}, form)).error);
  assert.equal(revalidated.length, 0);
  returned = traveler;
  form.set('profileId', owner); // The action never forwards a caller-supplied owner identity.
  await assert.rejects(
    () => exportsObject.removeTraveler({}, form),
    /REDIRECT:\/travelers\?removed=1/,
  );
  assert.equal(calls.at(-1).name, 'remove_owned_traveler');
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).args)), { p_character_id: traveler });
  assert.equal(revalidated.length, 1);
  console.log(
    'Traveler removal: confirmation, session, denial, return-value, and redirect checks passed.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
