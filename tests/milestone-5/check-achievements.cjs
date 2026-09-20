/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked Hall of Legends regression runner. */
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
      require: (name) => (assert.ok(name in dependencies, name), dependencies[name]),
      Intl,
    },
  );
  return exports;
}

const achievements = load('src/lib/achievements.ts', { 'server-only': {}, zod: require('zod') });
const lodgeId = '11111111-1111-4111-8111-111111111111';
const achievementId = '22222222-2222-4222-8222-222222222222';
let calls = [];
let rows = [];
let detail = null;
const entry = (overrides = {}) => ({
  id: achievementId,
  lodge_id: lodgeId,
  character_id: null,
  created_by: '33333333-3333-4333-8333-333333333333',
  title: 'Ahead of the Curve',
  description: 'A shared victory over the final encounter.',
  achieved_at: '2026-09-18T19:30:00.000Z',
  source: 'manual',
  created_at: '2026-09-18T20:00:00.000Z',
  profiles: { display_name: 'Wrenx' },
  characters: null,
  ...overrides,
});
const client = {
  from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'order', 'limit'])
      query[method] = (...args) => {
        calls.push([table, method, ...args]);
        return query;
      };
    query.maybeSingle = () => Promise.resolve({ data: detail, error: null });
    query.then = (resolve, reject) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    return query;
  },
};
let passed = 0;
async function check(label, run) {
  calls = [];
  rows = [entry()];
  detail = entry();
  await run();
  passed++;
  console.log(`PASS: ${label}`);
}

(async () => {
  await check('list reads stay in the selected Lodge and are bounded', async () => {
    assert.equal((await achievements.loadAchievements(client, lodgeId))[0].id, achievementId);
    assert.ok(
      calls.some((call) => call[1] === 'eq' && call[2] === 'lodge_id' && call[3] === lodgeId),
    );
    assert.ok(calls.some((call) => call[1] === 'limit' && call[2] === 100));
  });
  await check('detail reads require achievement and Lodge identifiers', async () => {
    await achievements.loadAchievement(client, achievementId, lodgeId);
    assert.ok(
      calls.some((call) => call[1] === 'eq' && call[2] === 'id' && call[3] === achievementId),
    );
    assert.ok(
      calls.some((call) => call[1] === 'eq' && call[2] === 'lodge_id' && call[3] === lodgeId),
    );
  });
  await check('search happens after the scoped database read', async () => {
    rows = [
      entry(),
      entry({
        id: '44444444-4444-4444-8444-444444444444',
        title: 'Quiet morning',
        description: 'Breakfast before the journey.',
      }),
    ];
    const result = await achievements.loadAchievements(client, lodgeId, 'victory');
    assert.equal(result.length, 1);
    assert.equal(calls.filter((call) => call[1] === 'eq').length, 1);
  });
  await check('malformed rows fail safely and display labels retain the date', async () => {
    rows = [entry({ created_by: 'not-a-uuid' })];
    detail = rows[0];
    assert.equal(await achievements.loadAchievements(client, lodgeId), null);
    assert.equal(await achievements.loadAchievement(client, achievementId, lodgeId), null);
    assert.match(
      achievements.achievementDate(entry().achieved_at, entry().created_at),
      /September 18, 2026/,
    );
    assert.equal(achievements.achievementCredit(entry()), 'Lodge milestone');
  });
  console.log(`${passed} Hall of Legends checks passed.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
