/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked Chronicle regression runner. */
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
      Intl,
    },
  );
  return exports;
}

const chronicles = load('src/lib/chronicles.ts', { 'server-only': {}, zod: require('zod') });
const lodgeId = '11111111-1111-4111-8111-111111111111';
const entryId = '22222222-2222-4222-8222-222222222222';
const authorId = '33333333-3333-4333-8333-333333333333';
let calls = [];
let rows = [];
let detail = null;
let searchIds = [];

const client = {
  rpc(name, args) {
    calls.push(['rpc', name, args]);
    return Promise.resolve({ data: searchIds, error: null });
  },
  from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'range', 'in']) {
      query[method] = (...args) => {
        calls.push([table, method, ...args]);
        if (method === 'in') query.ids = args[1];
        return query;
      };
    }
    query.maybeSingle = () => Promise.resolve({ data: detail, error: null });
    query.then = (resolve, reject) =>
      Promise.resolve({
        data: query.ids ? rows.filter((row) => query.ids.includes(row.id)) : rows,
        error: null,
      }).then(resolve, reject);
    return query;
  },
};

function entry(overrides = {}) {
  return {
    id: entryId,
    lodge_id: lodgeId,
    author_id: authorId,
    title: 'The Lantern Festival',
    body: 'The Lodge gathered at dusk for a long-awaited victory.',
    image_url: null,
    created_at: '2026-09-18T19:30:00.000Z',
    updated_at: '2026-09-18T19:30:00.000Z',
    profiles: { display_name: 'Wrenx' },
    ...overrides,
  };
}

let passed = 0;
async function check(label, run) {
  calls = [];
  rows = [entry()];
  detail = entry();
  searchIds = [];
  await run();
  passed++;
  console.log(`PASS: ${label}`);
}

(async () => {
  await check('list reads are scoped to the selected Lodge and bounded', async () => {
    const result = await chronicles.loadChronicles(client, lodgeId);
    assert.equal(result.entries[0].id, entryId);
    assert.ok(
      calls.some(
        (call) =>
          call[0] === 'chronicle_entries' &&
          call[1] === 'eq' &&
          call[2] === 'lodge_id' &&
          call[3] === lodgeId,
      ),
    );
    assert.ok(calls.some((call) => call[1] === 'range' && call[2] === 0 && call[3] === 100));
  });

  await check('detail reads require both Chronicle and Lodge identifiers', async () => {
    await chronicles.loadChronicle(client, entryId, lodgeId);
    assert.ok(calls.some((call) => call[1] === 'eq' && call[2] === 'id' && call[3] === entryId));
    assert.ok(
      calls.some((call) => call[1] === 'eq' && call[2] === 'lodge_id' && call[3] === lodgeId),
    );
  });

  await check('search runs before the Lodge-scoped page read', async () => {
    rows = [
      entry(),
      entry({
        id: '44444444-4444-4444-8444-444444444444',
        title: 'A quiet morning',
        body: 'The Lodge met for breakfast before the journey.',
      }),
    ];
    searchIds = [{ id: entryId }];
    const result = await chronicles.loadChronicles(client, lodgeId, 'victory');
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].id, entryId);
    assert.ok(calls.some((call) => call[1] === 'search_lodge_chronicle_ids'));
    assert.ok(calls.some((call) => call[1] === 'in' && call[2] === 'id'));
  });

  await check('date filters remain within the selected Lodge query', async () => {
    await chronicles.loadChronicles(client, lodgeId, '', { from: '2026-09-01', to: '2026-09-30' });
    assert.ok(calls.some((call) => call[1] === 'gte' && call[2] === 'created_at'));
    assert.ok(calls.some((call) => call[1] === 'lte' && call[2] === 'created_at'));
    assert.ok(calls.some((call) => call[1] === 'eq' && call[2] === 'lodge_id'));
  });

  await check('malformed database rows fail safely', async () => {
    rows = [entry({ author_id: 'not-a-uuid' })];
    detail = entry({ author_id: 'not-a-uuid' });
    assert.equal(await chronicles.loadChronicles(client, lodgeId), null);
    assert.equal(await chronicles.loadChronicle(client, entryId, lodgeId), null);
  });

  await check('display helpers retain UTC dates and clean excerpts', async () => {
    assert.match(chronicles.chronicleDate(entry().created_at), /September 18, 2026/);
    assert.equal(chronicles.chronicleDate('not-a-date'), 'Date unavailable');
    assert.equal(chronicles.chronicleExcerpt('  A\n  shared\t memory.  '), 'A shared memory.');
    assert.equal(chronicles.chronicleExcerpt('abcdef', 4), 'abc…');
  });

  console.log(`${passed} Chronicle checks passed.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
