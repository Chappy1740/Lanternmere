/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused authorization regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, dependencies, extra = {}) {
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
      ...extra,
    },
  );
  return exports;
}
const nickname = load('src/lib/account-nickname.ts', { zod: require('zod') });
const owner = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
let actor = other;
const writes = [];
const actions = load('src/app/(app)/owner/accounts/actions.ts', {
  'next/cache': { revalidatePath() {} },
  zod: require('zod'),
  '@/lib/hearth/context': { getViewer: async () => ({ user: { id: actor } }) },
  '@/lib/env.server': { serverEnv: { APP_OWNER_PROFILE_ID: owner } },
  '@/lib/supabase/admin': {
    createAdminClient: () => ({
      rpc: async (name, args) => {
        writes.push({ name, args });
        return { error: null };
      },
    }),
  },
});
const signups = [];
const auth = load('src/app/(auth)/actions.ts', {
  'next/cache': { revalidatePath() {} },
  'next/headers': { headers: async () => ({ get: () => 'https://example.invalid' }) },
  'next/navigation': {
    redirect() {
      throw new Error('redirect');
    },
  },
  '@/lib/account-nickname': nickname,
  '@/lib/supabase/server': {
    createClient: async () => ({
      auth: {
        signUp: async (payload) => {
          signups.push(payload);
          return { error: null };
        },
      },
    }),
  },
});
const state = { error: null, success: null };
(async () => {
  for (const invalid of ['', 'a', 'email@example.com', 'Name\u200b'])
    assert.equal(nickname.gameNicknameSchema.safeParse(invalid).success, false);
  assert.equal(nickname.gameNicknameSchema.parse('  Wren  '), 'Wren');
  const form = new FormData();
  form.set('profileId', other);
  form.set('action', 'suspend');
  form.set('confirm', 'on');
  assert.ok((await actions.setAccountAccess(state, form)).error);
  assert.equal(writes.length, 0);
  actor = owner;
  form.set('profileId', owner);
  assert.ok((await actions.setAccountAccess(state, form)).error);
  assert.equal(writes.length, 0);
  form.set('profileId', other);
  form.delete('confirm');
  assert.ok((await actions.setAccountAccess(state, form)).error);
  assert.equal(writes.length, 0);
  form.set('confirm', 'on');
  assert.equal((await actions.setAccountAccess(state, form)).error, null);
  assert.equal(writes[0].args.p_actor_id, owner);
  assert.equal(writes[0].args.p_suspended, true);
  form.set('action', 'restore');
  await actions.setAccountAccess(state, form);
  assert.equal(writes[1].args.p_suspended, false);
  const registration = new FormData();
  registration.set('email', 'test@example.invalid');
  registration.set('password', 'test-fixture-password');
  registration.set('confirmPassword', 'test-fixture-password');
  assert.ok((await auth.signUp(state, registration)).error);
  assert.equal(signups.length, 0);
  registration.set('displayName', 'Wren');
  registration.set('directoryOptIn', 'on');
  await assert.rejects(() => auth.signUp(state, registration), /redirect/);
  assert.equal(signups[0].options.data.display_name, 'Wren');
  assert.equal(signups[0].options.data.directory_opt_in, true);
  assert.match(signups[0].options.emailRedirectTo, /next=\/account$/);
  registration.delete('directoryOptIn');
  await assert.rejects(() => auth.signUp(state, registration), /redirect/);
  assert.equal(signups[1].options.data.directory_opt_in, false);
  const callbacks = [];
  let current = owner;
  let fetched = 0;
  const personal = load(
    'src/lib/wow/personal-account.ts',
    {
      'server-only': {},
      'node:crypto': require('node:crypto'),
      zod: require('zod'),
      'next/server': {
        NextResponse: {
          redirect(url) {
            return { url: String(url), cookies: { set() {} }, headers: { set() {} } };
          },
        },
      },
      '@/lib/supabase/server': {
        createClient: async () => ({
          auth: { getUser: async () => ({ data: { user: { id: current } }, error: null }) },
        }),
      },
      '@/lib/supabase/admin': {
        createAdminClient: () => ({
          from: () => ({
            upsert: async (row) => {
              callbacks.push(row);
              return { error: null };
            },
          }),
        }),
      },
      '@/lib/wow/guild-claim': {
        getOwnedWowCharacters: async () => {
          fetched++;
          return [{ id: 1, name: 'Wren', realm: { slug: 'stormrage' } }];
        },
      },
    },
    { Buffer, Date },
  );
  const session = { state: 's'.repeat(64), profileId: owner, region: 'us', issuedAt: Date.now() };
  const request = {
    url: 'https://example.invalid/api/guild-claim/callback',
    nextUrl: { searchParams: new URLSearchParams({ state: session.state, code: 'fixture-code' }) },
    cookies: { get: () => ({ value: Buffer.from(JSON.stringify(session)).toString('base64url') }) },
  };
  current = other;
  assert.match((await personal.handlePersonalWowCallback(request)).url, /failed/);
  assert.equal(fetched, 0);
  assert.equal(callbacks.length, 0);
  current = owner;
  session.issuedAt = Date.now() - 700000;
  assert.match((await personal.handlePersonalWowCallback(request)).url, /failed/);
  assert.equal(fetched, 0);
  session.issuedAt = Date.now();
  request.nextUrl.searchParams.set('state', 'wrong');
  assert.equal(await personal.handlePersonalWowCallback(request), null);
  assert.equal(fetched, 0);
  request.nextUrl.searchParams.set('state', session.state);
  assert.match((await personal.handlePersonalWowCallback(request)).url, /connected/);
  assert.equal(callbacks[0].profile_id, owner);
  assert.equal('access_token' in callbacks[0], false);
  const profileRequests = [];
  const profiles = load(
    'src/lib/wow/guild-claim.ts',
    {
      'server-only': {},
      zod: require('zod'),
      '@/lib/env.server': {
        serverEnv: {
          BLIZZARD_CLIENT_ID: 'fixture-id',
          BLIZZARD_CLIENT_SECRET: 'fixture-secret',
          BLIZZARD_REDIRECT_URI: 'https://example.invalid/api/guild-claim/callback',
        },
      },
    },
    {
      Buffer,
      URL,
      URLSearchParams,
      AbortSignal,
      fetch: async (url) => {
        profileRequests.push(String(url));
        return {
          ok: true,
          json: async () =>
            String(url).includes('/oauth/token')
              ? { access_token: 'fixture-token' }
              : {
                  wow_accounts: [
                    {
                      characters: [
                        {
                          id: 1,
                          name: 'Wren',
                          realm: {
                            slug: 'stormrage',
                            name: { en_US: 'Stormrage', es_MX: 'Stormrage' },
                          },
                        },
                      ],
                    },
                  ],
                },
        };
      },
    },
  );
  const owned = await profiles.getOwnedWowCharacters('us', 'fixture-code');
  assert.equal(owned[0].realm.name, 'Stormrage');
  assert.equal(new URL(profileRequests[1]).searchParams.get('locale'), 'en_US');
  assert.equal(
    profiles.ownedWowCharacterSchema.safeParse({
      id: 1,
      name: 'Wren',
      realm: { slug: 'stormrage', name: 'Stormrage' },
    }).success,
    true,
  );
  assert.equal(
    profiles.ownedWowCharacterSchema.safeParse({
      id: 1,
      name: 'Wren',
      realm: { name: 'Stormrage' },
    }).success,
    false,
  );
  let accessError = null;
  let signedIn = true;
  let activityCalls = 0;
  const clientMock = {
    auth: {
      getUser: async () => ({ data: { user: signedIn ? { id: owner } : null }, error: null }),
    },
    rpc: async () => {
      activityCalls++;
      return { error: accessError };
    },
  };
  const server = load('src/lib/supabase/server.ts', {
    '@supabase/ssr': { createServerClient: () => clientMock },
    '@supabase/supabase-js': { AuthError: require('@supabase/supabase-js').AuthError },
    'next/headers': { cookies: async () => ({ getAll: () => [], set() {} }) },
    '@/lib/env.client': {
      clientEnv: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-fixture',
      },
    },
  });
  const guarded = await server.createClient();
  assert.equal((await guarded.auth.getUser()).data.user.id, owner);
  accessError = { code: '42501' };
  const denied = await guarded.auth.getUser();
  assert.equal(denied.data.user, null);
  assert.equal(denied.error.status, 403);
  signedIn = false;
  const previousCalls = activityCalls;
  await guarded.auth.getUser();
  assert.equal(activityCalls, previousCalls);
  console.log('Account management, signup consent, and personal OAuth boundaries passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
