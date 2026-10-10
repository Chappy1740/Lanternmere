/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Regression for private detail fallback. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const page = {};
const unavailable = () => null;
let result = { data: null, error: null };
let replyReads = 0;
const viewer = '22222222-2222-4222-8222-222222222222';
const id = '44444444-4444-4444-8444-444444444444';
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/app/(app)/signal-fire/[id]/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText,
  {
    exports: page,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      if (name === './not-found') return { default: unavailable };
      if (name === 'zod') return require('zod');
      if (name === '@/lib/env.server') return { serverEnv: { APP_OWNER_PROFILE_ID: 'owner' } };
      if (name === '@/lib/hearth/context')
        return {
          getViewer: async () => ({
            user: { id: viewer },
            supabase: {
              from(table) {
                if (table === 'app_feedback_replies') replyReads++;
                return {
                  select() {
                    return this;
                  },
                  eq() {
                    return this;
                  },
                  maybeSingle: async () => result,
                };
              },
            },
          }),
        };
      return {};
    },
  },
);
(async () => {
  const render = () =>
    page.default({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
  assert.equal((await render()).type, unavailable);
  result = { data: null, error: { code: 'lookup-failed' } };
  assert.equal((await render()).type, unavailable);
  result = {
    data: {
      id,
      sender_id: '33333333-3333-4333-8333-333333333333',
      category: 'problem',
      title: 'Private report',
      body: 'Private report body',
      page_context: null,
      status: 'new',
      created_at: '2026-10-10',
      closed_at: null,
    },
    error: null,
  };
  assert.equal((await render()).type, unavailable);
  assert.equal(replyReads, 0);
  console.log(
    'Denied, missing, and failed lookups render the same unavailable page without reading replies.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
