/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Owner inbox privacy regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const page = {};
const serverEnv = { APP_OWNER_PROFILE_ID: 'owner' };
let adminReads = 0;
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/app/(app)/owner/signal-fire/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText,
  {
    exports: page,
    require(name) {
      if (name === 'react/jsx-runtime')
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        };
      if (name === 'zod') return require('zod');
      if (name === '@/lib/env.server') return { serverEnv };
      if (name === '@/lib/hearth/context')
        return { getViewer: async () => ({ user: { id: 'member' } }) };
      if (name === '@/lib/supabase/admin')
        return {
          createAdminClient() {
            adminReads++;
            throw new Error('Denied viewers must not query reports');
          },
        };
      return {};
    },
  },
);
(async () => {
  for (const ownerId of ['owner', undefined]) {
    serverEnv.APP_OWNER_PROFILE_ID = ownerId;
    const tree = await page.default({ searchParams: Promise.resolve({}) });
    assert.equal(tree.props.children[0].props.children, 'Owner access required');
    assert.match(tree.props.children[1].props.children, /only available to the Lanternmere owner/);
    assert.equal(tree.props.children[2].props.href, '/signal-fire');
  }
  assert.equal(adminReads, 0);
  console.log(
    'Non-owner and unconfigured-owner inbox denial shows guidance without querying reports.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
