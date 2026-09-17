/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked data-access regression runner. */
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const zod = require('zod');
function load(file, deps) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (n) => {
        assert.ok(n in deps, n);
        return deps[n];
      },
    },
  );
  return exports;
}
const portrait = load('src/lib/wow/portrait.ts', {});
const display = load('src/lib/wow/character-display.ts', { zod, './portrait': portrait });
let main, snapshot, queryError, snapshotError, thrown, filters;
const id = '11111111-1111-4111-8111-111111111111';
const client = {
  from(table) {
    return {
      select() {
        return this;
      },
      eq(k, v) {
        filters.push([table, k, v]);
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      async maybeSingle() {
        if (thrown === table) throw Error('PRIVATE_DB_ERROR');
        return table === 'characters'
          ? { data: main, error: queryError }
          : { data: snapshot, error: snapshotError };
      },
    };
  },
};
const { loadMainCharacter } = load('src/lib/hearth/main-character.ts', {
  'server-only': {},
  zod,
  '@/lib/wow/character-display': display,
  '@/lib/wow/refresh-status': {
    loadRefreshFailures: async () => ({ latest: new Map(), unavailable: true }),
  },
});
let passed = 0;
async function check(name, fn) {
  main = {
    id,
    character_name: 'Wrenx',
    realm_slug: 'stormrage',
    region: 'us',
    class: 'Rogue',
    faction: 'Alliance',
    level: 90,
  };
  snapshot = {
    source: 'blizzard',
    last_refreshed_at: '2026-09-16T15:40:00Z',
    snapshot_data: { name: 'Wrenx', equipped_item_level: 319 },
  };
  queryError = snapshotError = thrown = null;
  filters = [];
  await fn();
  console.log('PASS: ' + name);
  passed++;
}
(async () => {
  await check('owner, Main and WoW restrictions are applied', async () => {
    const r = await loadMainCharacter(client, 'owner');
    assert.equal(r.state, 'ready');
    for (const [k, v] of [
      ['profile_id', 'owner'],
      ['is_main', true],
      ['games.slug', 'wow'],
    ])
      assert.ok(filters.some(([t, key, val]) => t === 'characters' && key === k && val === v));
    assert.equal(r.profile.equipped_item_level, 319);
  });
  await check('no Main returns empty state', async () => {
    main = null;
    assert.equal((await loadMainCharacter(client, 'owner')).state, 'empty');
  });
  await check('database errors return safe section error', async () => {
    queryError = true;
    const r = await loadMainCharacter(client, 'owner');
    assert.equal(r.state, 'error');
    assert.ok(!JSON.stringify(r).includes('PRIVATE'));
  });
  await check('malformed character returns section error', async () => {
    main = {};
    assert.equal((await loadMainCharacter(client, 'owner')).state, 'error');
  });
  await check('network failure returns section error', async () => {
    thrown = 'characters';
    assert.equal((await loadMainCharacter(client, 'owner')).state, 'error');
  });
  await check('missing snapshot preserves basic character', async () => {
    snapshot = null;
    const r = await loadMainCharacter(client, 'owner');
    assert.equal(r.state, 'ready');
    assert.equal(r.character.character_name, 'Wrenx');
    assert.equal(r.snapshot, null);
  });
  await check('snapshot query error preserves basic character', async () => {
    snapshotError = true;
    const r = await loadMainCharacter(client, 'owner');
    assert.equal(r.state, 'ready');
    assert.equal(r.snapshotUnavailable, true);
    assert.equal(r.snapshot, null);
  });
  await check('snapshot network rejection is isolated', async () => {
    thrown = 'character_snapshots';
    const r = await loadMainCharacter(client, 'owner');
    assert.equal(r.state, 'ready');
    assert.equal(r.snapshotUnavailable, true);
  });
  await check('missing refresh status does not hide main', async () => {
    const r = await loadMainCharacter(client, 'owner');
    assert.equal(r.state, 'ready');
    assert.equal(r.statusUnavailable, true);
  });
  console.log(`${passed} Main character checks passed.`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
