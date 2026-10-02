/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked readiness display regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const ids = Array.from(
  { length: 7 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const lodgeId = '11111111-1111-4111-8111-111111111111';
const data = {
  character_raiderio_sharing: ids.map((character_id) => ({ character_id })),
  character_raiderio_snapshots: [
    {
      character_id: ids[0],
      character_name: 'Saved',
      realm_slug: 'stormrage',
      region: 'us',
      mythic_plus_score: 1234,
      source_url: 'https://raider.io/a',
      refreshed_at: '2026-10-01T00:00:00Z',
      failure_message: null,
    },
  ],
  character_raiderio_refresh_attempts: [
    {
      character_id: ids[1],
      character_name: 'Pending',
      realm_slug: 'stormrage',
      region: 'us',
      attempted_at: '2026-10-02T00:00:00Z',
      failure_message: 'Raider.IO is busy.',
    },
  ],
  character_raidbots_reports: [
    {
      character_id: ids[0],
      lodge_id: lodgeId,
      character_name: 'Saved',
      realm_slug: 'stormrage',
      region: 'us',
      report_url: 'https://raidbots.com/simbot/report/a',
      upgrade_targets: 'A player note',
      updated_at: '2026-10-02T00:00:00Z',
    },
  ],
};
const calls = [];
const client = {
  from(table) {
    const query = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      in() {
        return this;
      },
      order() {
        return this;
      },
      limit(count) {
        calls.push([table, 'limit', count]);
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({ data: data[table], error: null }).then(resolve, reject);
      },
    };
    assert.ok(table in data);
    return query;
  },
};
const moduleExports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/adventures/raiderio-readiness.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: moduleExports,
    require(name) {
      assert.ok(name === 'server-only' || name === 'zod');
      return name === 'zod' ? require('zod') : {};
    },
    Map,
    Promise,
    Date,
  },
);

(async () => {
  const readiness = await moduleExports.loadRaiderIoReadiness(client, lodgeId);
  assert.equal(readiness.state, 'ready');
  assert.equal(readiness.snapshots.length, 1);
  assert.equal(readiness.pending.length, 5);
  assert.equal(readiness.pending[0].attempt.failure_message, 'Raider.IO is busy.');
  assert.equal(readiness.hasMore, true);
  assert.ok(
    calls.some(
      ([table, method, count]) =>
        table === 'character_raiderio_sharing' && method === 'limit' && count === 7,
    ),
  );
  console.log('PASS: readiness includes first failures, missing snapshots, and a more indicator');

  const raidbots = await moduleExports.loadRaidbotsReadiness(client, lodgeId);
  assert.equal(raidbots.state, 'ready');
  assert.equal(raidbots.reports[0].character_id, ids[0]);
  assert.equal(raidbots.reports[0].lodge_id, lodgeId);
  console.log('PASS: Raidbots rows carry stable character and Lodge keys');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
