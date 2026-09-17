/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked server-render regression runner. */
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const zod = require('zod');
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  return exports;
}
const id = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const membership = (key, name) => ({
  lodge_id: key,
  role: 'member',
  lodges: { id: key, name, description: null },
});
const navigation = {
  redirect: (url) => {
    throw Error(url);
  },
  notFound: () => {
    throw Error('NOT_FOUND');
  },
};
let user, authError, dbError, rows, filters, profile, profileError;
const client = {
  auth: { getUser: async () => ({ data: { user }, error: authError }) },
  from: () => ({
    select() {
      return this;
    },
    eq(key, value) {
      filters.push([key, value]);
      return this;
    },
    order(key) {
      return key === 'id' ? Promise.resolve({ data: rows, error: dbError }) : this;
    },
    maybeSingle: async () => ({ data: profile, error: profileError }),
  }),
};
const context = load('src/lib/hearth/context.ts', {
  'server-only': {},
  react: { cache: (fn) => fn },
  'next/navigation': navigation,
  zod,
  '@/lib/supabase/server': { createClient: async () => client },
});
const jsx = (type, props) => ({ type: typeof type === 'function' ? type.name : type, props });
const page = load('src/app/(app)/(lodge)/hearth/page.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'next/link': { default: 'a' },
  'next/navigation': navigation,
  'lucide-react': { Flame: 'flame' },
  '@/lib/hearth/context': context,
  '@/components/lodge-activity': { LodgeActivity: 'activity' },
  '@/components/lodge-roster': { LodgeRoster: 'roster' },
  '@/components/main-character-highlight': { MainCharacterHighlight: 'main-highlight' },
}).default;
function reset() {
  user = { id };
  authError = dbError = profileError = null;
  filters = [];
  rows = [membership(id, 'First Lodge'), membership(second, 'Second Lodge')];
  profile = { display_name: ' Wren ' };
}
let passed = 0;
async function check(label, fn) {
  reset();
  await fn();
  console.log('PASS: ' + label);
  passed++;
}
const render = async (lodge) =>
  JSON.stringify(
    await page({ searchParams: Promise.resolve(lodge === undefined ? {} : { lodge }) }),
  );
(async () => {
  await check('unauthenticated access redirects', async () => {
    user = null;
    await assert.rejects(context.getViewer(), /sign-in/);
  });
  await check('authentication errors fail closed', async () => {
    authError = true;
    await assert.rejects(context.getViewer(), /sign-in/);
  });
  await check('no membership redirects to onboarding', async () => {
    rows = [];
    await assert.rejects(context.getLodgeMemberships(), /lodges\/new/);
  });
  await check('membership query errors fail closed', async () => {
    dbError = true;
    await assert.rejects(context.getLodgeMemberships(), /Unable to verify/);
  });
  await check('malformed membership data fails closed', async () => {
    rows = [{}];
    await assert.rejects(context.getLodgeMemberships(), /Unable to verify/);
  });
  await check('membership queries use verified user', async () => {
    await context.getLodgeMemberships();
    assert.ok(filters.some(([k, v]) => k === 'profile_id' && v === id));
  });
  await check('welcome uses trimmed real profile name', async () => {
    assert.match(await render(), /Welcome back, Wren/);
  });
  await check('profile failure keeps Lodge and neutral welcome', async () => {
    profileError = true;
    const output = await render();
    assert.match(output, /Welcome back\./);
    assert.match(output, /First Lodge/);
  });
  await check('default and explicit memberships render', async () => {
    assert.match(await render(), /First Lodge/);
    const output = await render(second);
    assert.match(output, /Second Lodge/);
    assert.match(output, /Choose a Lodge/);
  });
  await check('foreign, malformed and repeated selections rejected', async () => {
    for (const value of ['33333333-3333-4333-8333-333333333333', 'invalid', [id, second]])
      await assert.rejects(render(value), /NOT_FOUND/);
  });
  await check('single Lodge requires no selector', async () => {
    rows = [membership(id, 'Only Lodge')];
    assert.doesNotMatch(await render(), /Choose a Lodge/);
  });
  console.log(`${passed} Hearth context checks passed.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
