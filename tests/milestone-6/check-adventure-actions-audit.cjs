/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked denied-write regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const id = '11111111-1111-4111-8111-111111111111';
let writing = false;
const client = {
  auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
  from() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      update() {
        writing = true;
        return this;
      },
      delete() {
        writing = true;
        return this;
      },
      maybeSingle: async () => ({
        data: writing ? null : { id, target_count: 10 },
        error: null,
      }),
    };
  },
};
function load(path) {
  const moduleExports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports: moduleExports,
      FormData,
      require(name) {
        const dependencies = {
          'next/cache': { revalidatePath() {} },
          zod: require('zod'),
          '@/lib/supabase/server': { createClient: async () => client },
        };
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return moduleExports;
}

(async () => {
  const campaigns = load('src/app/(app)/(lodge)/adventures/campaign-actions.ts');
  const campaignForm = new FormData();
  campaignForm.set('campaignId', id);
  campaignForm.set('progressCount', '4');
  campaignForm.set('status', 'active');
  let result = await campaigns.updateCampaignProgress({}, campaignForm);
  assert.equal(result.success, null);
  assert.match(result.error, /could not be updated/);
  console.log('PASS: zero-row campaign update never reports success');

  writing = false;
  const plans = load('src/app/(app)/(lodge)/adventures/actions.ts');
  const templateForm = new FormData();
  templateForm.set('templateId', id);
  result = await plans.deleteEventTemplate({}, templateForm);
  assert.equal(result.success, null);
  assert.match(result.error, /could not be removed/);
  console.log('PASS: zero-row recurring-plan delete never reports success');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
