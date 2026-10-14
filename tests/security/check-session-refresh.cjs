/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked session-refresh regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, dependencies) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (name) => dependencies[name] },
  );
  return exports;
}

let clients = 0;
let verifications = 0;
const issued = [
  { name: 'sb-fixture-auth-token.0', value: 'fixture-a', options: { httpOnly: true } },
  { name: 'sb-fixture-auth-token.1', value: 'fixture-b', options: { sameSite: 'lax' } },
];
const middleware = load('src/lib/supabase/middleware.ts', {
  '@/lib/env.client': { clientEnv: {} },
  'next/server': {
    NextResponse: {
      next(input) {
        const forwarded = [];
        return { input, forwarded, cookies: { set: (...args) => forwarded.push(args) } };
      },
    },
  },
  '@supabase/ssr': {
    createServerClient(_url, _key, { cookies }) {
      clients++;
      return {
        auth: {
          async getUser() {
            verifications++;
            assert.equal(cookies.getAll().length, 2);
            cookies.setAll(issued);
          },
        },
      };
    },
  },
});

(async () => {
  const fresh = await middleware.updateSession({ cookies: { getAll: () => [] } });
  assert.equal(clients, 0);
  assert.equal(fresh.forwarded.length, 0);

  const changed = [];
  const request = {
    cookies: {
      getAll: () => issued.map(({ name, value }) => ({ name, value })),
      set: (...args) => changed.push(args),
    },
  };
  const refreshed = await middleware.updateSession(request);
  assert.equal(clients, 1);
  assert.equal(verifications, 1);
  assert.equal(refreshed.input.request, request);
  assert.deepEqual(
    changed,
    issued.map(({ name, value }) => [name, value]),
  );
  assert.deepEqual(
    refreshed.forwarded,
    issued.map(({ name, value, options }) => [name, value, options]),
  );

  const { getViewer } = load('src/lib/hearth/context.ts', {
    'server-only': {},
    react: { cache: (fn) => fn },
    zod: require('zod'),
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      }),
    },
    'next/navigation': {
      redirect: (path) => {
        throw new Error(`redirect:${path}`);
      },
    },
  });
  await assert.rejects(getViewer, /redirect:\/sign-in/);
  console.log(
    'Cookie-free requests avoid refresh setup; existing sessions still verify and forward all refreshed cookies; protected viewers still redirect.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
