/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked roster regression runner. */
const fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript'),
  assert = require('node:assert/strict');
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/hearth/roster.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: exportsObject,
    require: (n) => {
      if (n === 'server-only') return {};
      if (n === 'zod') return require('zod');
      throw Error(n);
    },
  },
);
const { loadLodgeRoster } = exportsObject;
const id = '11111111-1111-4111-8111-111111111111',
  lodge = '22222222-2222-4222-8222-222222222222';
let rows, chars, count, error, characterError, throws, calls;
const client = {
  from(table) {
    const q = {
      select(...v) {
        calls.push([table, 'select', ...v]);
        return q;
      },
      eq(...v) {
        calls.push([table, 'eq', ...v]);
        return q;
      },
      in(...v) {
        calls.push([table, 'in', ...v]);
        return q;
      },
      order() {
        return q;
      },
      limit(...v) {
        calls.push([table, 'limit', ...v]);
        return q;
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => {
            if (throws === table) throw Error('PRIVATE');
            return table === 'lodge_members'
              ? { data: rows, count, error }
              : { data: chars, error: characterError };
          })
          .then(resolve, reject);
      },
    };
    return q;
  },
};
let passed = 0;
async function check(label, fn) {
  rows = [{ profile_id: id, role: 'owner', profiles: { display_name: 'Will' } }];
  chars = [
    {
      id,
      profile_id: id,
      character_name: 'wrenx',
      realm_slug: 'stormrage',
      region: 'us',
      character_snapshots: [],
    },
  ];
  count = 9;
  error = characterError = throws = null;
  calls = [];
  await fn();
  console.log('PASS: ' + label);
  passed++;
}
(async () => {
  await check('exact Lodge membership count and bounded preview', async () => {
    const r = await loadLodgeRoster(client, lodge);
    assert.equal(r.total, 9);
    assert.equal(r.members.length, 1);
    assert.ok(
      calls.some(
        (c) => c[0] === 'lodge_members' && c[1] === 'eq' && c[2] === 'lodge_id' && c[3] === lodge,
      ),
    );
    assert.ok(calls.some((c) => c[0] === 'lodge_members' && c[1] === 'limit' && c[2] === 6));
    assert.ok(calls.some((c) => c[1] === 'select' && c[3]?.count === 'exact'));
  });
  await check('Main query requires selected-Lodge sharing and current roster', async () => {
    const r = await loadLodgeRoster(client, lodge);
    assert.equal(r.mains.get(id).character_name, 'wrenx');
    for (const [k, v] of [
      ['character_lodges.lodge_id', lodge],
      ['is_main', true],
      ['games.slug', 'wow'],
    ])
      assert.ok(
        calls.some((c) => c[0] === 'characters' && c[1] === 'eq' && c[2] === k && c[3] === v),
      );
    assert.ok(calls.some((c) => c[1] === 'in' && c[2] === 'profile_id' && c[3][0] === id));
  });
  await check('unshared Main is not fabricated', async () => {
    chars = [];
    assert.equal((await loadLodgeRoster(client, lodge)).mains.size, 0);
  });
  await check('missing profile remains a member', async () => {
    rows[0].profiles = null;
    assert.equal((await loadLodgeRoster(client, lodge)).members.length, 1);
  });
  await check('character query failure retains membership content', async () => {
    characterError = true;
    const r = await loadLodgeRoster(client, lodge);
    assert.equal(r.state, 'ready');
    assert.equal(r.charactersUnavailable, true);
    assert.equal(r.members.length, 1);
  });
  await check('character network failure is isolated', async () => {
    throws = 'characters';
    assert.equal((await loadLodgeRoster(client, lodge)).charactersUnavailable, true);
  });
  await check('membership failures and invalid data return safe error', async () => {
    for (const mode of ['error', 'throws', 'invalid']) {
      error = mode === 'error';
      throws = mode === 'throws' ? 'lodge_members' : null;
      rows = mode === 'invalid' ? [{}] : [];
      const r = await loadLodgeRoster(client, lodge);
      assert.equal(r.state, 'error');
      assert.ok(!JSON.stringify(r).includes('PRIVATE'));
    }
  });
  await check('empty membership avoids character query', async () => {
    rows = [];
    count = 0;
    const r = await loadLodgeRoster(client, lodge);
    assert.equal(r.total, 0);
    assert.ok(!calls.some((c) => c[0] === 'characters'));
  });
  console.log(`${passed} roster checks passed.`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
