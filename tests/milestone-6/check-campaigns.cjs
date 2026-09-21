/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked campaign regression runner. */
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

const campaigns = load('src/lib/adventures/campaigns.ts', {
  'server-only': {},
  zod: require('zod'),
});
const lodgeId = '11111111-1111-4111-8111-111111111111';
const row = {
  id: '22222222-2222-4222-8222-222222222222',
  lodge_id: lodgeId,
  created_by: '33333333-3333-4333-8333-333333333333',
  title: 'Citadel',
  goal: null,
  target_count: 8,
  progress_count: 3,
  status: 'active',
};
let calls = [];
const client = {
  from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'order', 'limit'])
      query[method] = (...args) => {
        calls.push([table, method, ...args]);
        return query;
      };
    query.then = (resolve, reject) =>
      Promise.resolve({ data: [row], error: null }).then(resolve, reject);
    return query;
  },
};

(async () => {
  const result = await campaigns.loadLodgeCampaigns(client, lodgeId);
  assert.equal(result[0].id, row.id);
  assert.ok(calls.some((call) => call.join('|') === `lodge_campaigns|eq|lodge_id|${lodgeId}`));
  assert.equal(campaigns.campaignProgress(row), '3 of 8');
  assert.equal(
    campaigns.campaignProgress({ ...row, target_count: null }),
    'Progress is tracked in the campaign notes.',
  );
  const sql = fs.readFileSync('supabase/migrations/20260921085040_lodge_campaigns.sql', 'utf8');
  for (const policy of [
    'lodge_campaigns_select_member',
    'lodge_campaigns_insert_member',
    'lodge_campaigns_update_creator_or_admin',
    'lodge_campaigns_delete_creator_or_admin',
  ])
    assert.match(sql, new RegExp(policy));
  assert.match(sql, /alter table public\.lodge_campaigns enable row level security/);
  console.log('5 campaign checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
