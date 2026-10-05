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
      URL,
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
          signOut: async () => {
            signedOut += 1;
            return { error: null };
          },
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
  assert.match(
    (await auth.signIn(state, credentials)).error,
    /Confirm your email before signing in/,
  );
  assert.equal(signedOut, 1);
  signInError = { code: 'invalid_credentials' };
  assert.equal((await auth.signIn(state, credentials)).error, 'Invalid email or password.');
  signInError = { code: 'request_timeout' };
  assert.match((await auth.signIn(state, credentials)).error, /temporarily unavailable/);

  let requestOrigin = 'https://example.invalid';
  let resendError = null;
  let resendThrows = false;
  const resendCalls = [];
  const recovery = load('src/app/(auth)/actions.ts', {
    ...next,
    'next/headers': { headers: async () => ({ get: () => requestOrigin }) },
    '@/lib/account-nickname': { gameNicknameSchema: {} },
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: {
          resend: async (payload) => {
            resendCalls.push(payload);
            if (resendThrows) throw new Error('private upstream detail');
            return { error: resendError };
          },
        },
      }),
    },
  });
  const confirmationForm = new FormData();
  confirmationForm.set('email', 'not-an-email');
  assert.match(
    (await recovery.resendConfirmation(state, confirmationForm)).error,
    /signup|sign up/,
  );
  assert.equal(resendCalls.length, 0);
  confirmationForm.set('email', ' fixture@example.invalid ');
  const accepted = await recovery.resendConfirmation(state, confirmationForm);
  assert.equal(accepted.error, null);
  assert.equal(resendCalls[0].type, 'signup');
  assert.equal(resendCalls[0].email, 'fixture@example.invalid');
  assert.equal(
    resendCalls[0].options.emailRedirectTo,
    'https://example.invalid/auth/callback?next=/account',
  );
  for (const code of ['user_not_found', 'email_already_confirmed', 'email_exists']) {
    resendError = { status: 400, code };
    assert.equal(
      (await recovery.resendConfirmation(state, confirmationForm)).success,
      accepted.success,
    );
  }
  resendError = { status: 429, code: 'over_email_send_rate_limit' };
  assert.match(
    (await recovery.resendConfirmation(state, confirmationForm)).error,
    /wait a few minutes/,
  );
  resendError = { status: 503 };
  assert.match(
    (await recovery.resendConfirmation(state, confirmationForm)).error,
    /try again later/,
  );
  resendThrows = true;
  assert.match((await recovery.resendConfirmation(state, confirmationForm)).error, /unavailable/);
  resendThrows = false;
  requestOrigin = null;
  const requestCount = resendCalls.length;
  assert.match((await recovery.resendConfirmation(state, confirmationForm)).error, /unavailable/);
  assert.equal(resendCalls.length, requestCount);

  let exchangeError = null;
  let exchanges = 0;
  let exchangeOptions;
  const callback = load('src/app/auth/callback/route.ts', {
    'next/server': {
      NextResponse: { redirect: (url) => ({ url: url.href, cookies: { set() {} } }) },
    },
    '@/lib/env.client': {
      clientEnv: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public-key',
      },
    },
    '@supabase/ssr': {
      createServerClient: () => ({
        auth: {
          exchangeCodeForSession: async (_code, options) => {
            exchanges += 1;
            exchangeOptions = options;
            return { error: exchangeError };
          },
        },
      }),
    },
  });
  const openCallback = (query) => {
    const url = new URL(`https://example.invalid/auth/callback?${query}`);
    return callback.GET({ nextUrl: url, url: url.href, cookies: { getAll: () => [] } });
  };
  assert.match(
    (await openCallback('error=access_denied&error_code=otp_expired&next=/account')).url,
    /confirmationExpired=1$/,
  );
  assert.equal(exchanges, 0);
  assert.equal(
    (await openCallback('error=access_denied&next=/reset-password')).url,
    'https://example.invalid/forgot-password?expired=1',
  );
  assert.equal(
    (await openCallback('next=/account')).url,
    'https://example.invalid/sign-in?confirmationError=1',
  );
  assert.equal(
    (await openCallback('code=fixture&next=/account')).url,
    'https://example.invalid/account',
  );
  assert.equal(exchangeOptions, undefined);
  await openCallback('code=fixture&next=/account&sb_flow_id=fixture-flow');
  assert.equal(exchangeOptions.flowId, 'fixture-flow');
  assert.equal(
    (await openCallback('code=fixture&next=https://foreign.invalid')).url,
    'https://example.invalid/sign-in',
  );
  exchangeError = { code: 'bad_code_verifier' };
  assert.equal(
    (await openCallback('code=fixture&next=/account')).url,
    'https://example.invalid/sign-in?confirmationError=1',
  );

  let lodgeCalls = 0;
  const lodges = load('src/app/(app)/lodges/new/actions.ts', {
    ...next,
    '@/lib/supabase/server': {
      createClient: async () => ({
        rpc: async () => {
          lodgeCalls += 1;
          return { error: { message: 'private database detail' } };
        },
      }),
    },
  });
  const lodgeForm = new FormData();
  lodgeForm.set('name', 'A'.repeat(61));
  assert.match((await lodges.createLodge(state, lodgeForm)).error, /60 characters/);
  assert.equal(lodgeCalls, 0);
  lodgeForm.set('name', 'Audit Lodge');
  assert.equal(
    (await lodges.createLodge(state, lodgeForm)).error,
    'The Lodge could not be created. Please try again.',
  );
  assert.equal(lodgeCalls, 1);

  console.log('Front Door audit action checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
