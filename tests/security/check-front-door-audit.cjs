/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked server-action regression runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(path, dependencies) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require(name) {
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return exports;
}

const state = { error: null };
const token = 'a'.repeat(43);
const id = '11111111-1111-4111-8111-111111111111';
const form = new FormData();
form.set('token', token);
const redirects = [];
const revalidations = [];
const next = {
  'next/navigation': {
    redirect(path) {
      redirects.push(path);
      throw new Error('NEXT_REDIRECT');
    },
  },
  'next/cache': { revalidatePath: (path) => revalidations.push(path) },
  zod: require('zod'),
};

async function checkInvitation(path, action, rpcName, destination) {
  let rpcError = null;
  const actionExports = load(path, {
    ...next,
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
        rpc: async (name, args) => {
          assert.equal(name, rpcName);
          assert.equal(args.p_token, token);
          return { data: id, error: rpcError };
        },
      }),
    },
  });
  const accept = actionExports[action];
  await assert.rejects(() => accept(state, form), /NEXT_REDIRECT/);
  assert.equal(redirects.at(-1), destination);
  rpcError = { message: 'unavailable' };
  assert.match((await accept(state, form)).error, /unavailable/);
}

(async () => {
  await checkInvitation(
    'src/app/invitations/[token]/actions.ts',
    'acceptLodgeInvitation',
    'redeem_lodge_invitation',
    `/hearth?lodge=${id}`,
  );
  assert.deepEqual(revalidations, ['/hearth', '/caretakers-office']);
  await checkInvitation(
    'src/app/guild-invitations/[token]/actions.ts',
    'acceptGuildInvitation',
    'redeem_guild_invitation',
    `/guild-hall?guild=${id}`,
  );

  let signedOut = 0;
  let signInError = null;
  const auth = load('src/app/(auth)/actions.ts', {
    ...next,
    'next/headers': { headers: async () => ({ get: () => null }) },
    '@/lib/account-nickname': { gameNicknameSchema: {} },
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: {
          signInWithPassword: async () => ({ error: signInError }),
          getUser: async () => ({ error: { code: 'account_suspended' } }),
          signOut: async () => { signedOut += 1; return { error: null }; },
        },
      }),
    },
  });
  const credentials = new FormData();
  credentials.set('email', 'fixture@example.invalid');
  credentials.set('password', 'fixture-password');
  assert.match((await auth.signIn(state, credentials)).error, /cannot currently access/);
  assert.equal(signedOut, 1);
  signInError = { code: 'email_not_confirmed' };
  assert.match((await auth.signIn(state, credentials)).error, /Confirm your email before signing in/);
  assert.equal(signedOut, 1);
  signInError = { code: 'invalid_credentials' };
  assert.equal((await auth.signIn(state, credentials)).error, 'Invalid email or password.');
  signInError = { code: 'request_timeout' };
  assert.match((await auth.signIn(state, credentials)).error, /temporarily unavailable/);

  let lodgeCalls = 0;
  const lodges = load('src/app/(app)/lodges/new/actions.ts', {
    ...next,
    '@/lib/supabase/server': {
      createClient: async () => ({
        rpc: async () => { lodgeCalls += 1; return { error: { message: 'private database detail' } }; },
      }),
    },
  });
  const lodgeForm = new FormData();
  lodgeForm.set('name', 'A'.repeat(61));
  assert.match((await lodges.createLodge(state, lodgeForm)).error, /60 characters/);
  assert.equal(lodgeCalls, 0);
  lodgeForm.set('name', 'Audit Lodge');
  assert.equal((await lodges.createLodge(state, lodgeForm)).error, 'The Lodge could not be created. Please try again.');
  assert.equal(lodgeCalls, 1);

  console.log('Front Door audit action checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
