/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked activity regression runner. */
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, dependencies) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return exports;
}
const activity = load('src/lib/hearth/activity.ts', { 'server-only': {}, zod: require('zod') });
const lodge = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-09-17T00:01:00Z');
const tables = ['events', 'achievements', 'chronicle_entries'];
let rows, failure, calls, memberships, authFailure;
const client = {
  from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'gte', 'order', 'limit'])
      query[method] = (...args) => {
        calls.push([table, method, ...args]);
        return query;
      };
    query.then = (resolve, reject) =>
      Promise.resolve()
        .then(() => {
          if (failure?.table === table && failure.mode === 'throw') throw Error('PRIVATE');
          return {
            data: rows[table],
            error: failure?.table === table ? { message: 'PRIVATE' } : null,
          };
        })
        .then(resolve, reject);
    return query;
  },
};
const { LodgeActivity } = load('src/components/lodge-activity.tsx', {
  'react/jsx-runtime': require('react/jsx-runtime'),
  'next/link': { default: ({ children }) => children },
  '@/lib/hearth/activity': activity,
  '@/lib/hearth/context': {
    getViewer: async () => {
      if (authFailure) throw Error('SIGN_IN');
      return { supabase: client };
    },
    getLodgeMemberships: async () => memberships,
  },
});
const render = async () => renderToStaticMarkup(await LodgeActivity({ lodgeId: lodge }));
let passed = 0;
async function check(label, fn) {
  rows = {
    events: [
      {
        id,
        title: 'Raid night',
        event_date: '2026-09-18',
        event_time: null,
        activity_type: null,
        difficulty: null,
      },
    ],
    achievements: [
      {
        id,
        title: 'First victory',
        description: null,
        achieved_at: null,
        created_at: now.toISOString(),
      },
    ],
    chronicle_entries: [
      {
        id,
        title: null,
        body: null,
        image_url: 'https://example.com/photo.jpg',
        created_at: now.toISOString(),
      },
    ],
  };
  calls = [];
  failure = null;
  authFailure = false;
  memberships = [{ lodge_id: lodge }];
  await fn();
  passed++;
  console.log('PASS: ' + label);
}
(async () => {
  await check('every summary is scoped to the selected Lodge and limited to three', async () => {
    const result = await activity.loadLodgeActivity(client, lodge, now);
    for (const table of tables) {
      assert.ok(
        calls.some((c) => c[0] === table && c[1] === 'eq' && c[2] === 'lodge_id' && c[3] === lodge),
      );
      assert.ok(calls.some((c) => c[0] === table && c[1] === 'limit' && c[2] === 3));
    }
    assert.equal(result.events.rows[0].title, 'Raid night');
  });
  await check('UTC date boundary and deterministic summary ordering', async () => {
    await activity.loadLodgeActivity(client, lodge, now);
    assert.ok(calls.some((c) => c[1] === 'gte' && c[2] === 'event_date' && c[3] === '2026-09-17'));
    for (const table of tables) {
      const orders = calls.filter((c) => c[0] === table && c[1] === 'order');
      assert.equal(orders.at(-1)[2], 'id');
      assert.equal(orders[0][2], table === 'events' ? 'event_date' : 'created_at');
      if (table !== 'events') assert.equal(orders[0][3].ascending, false);
      else assert.equal(orders[1][3].nullsFirst, false);
    }
  });
  await check('each query or network failure leaves the other sections available', async () => {
    for (const table of tables)
      for (const mode of ['error', 'throw']) {
        failure = { table, mode };
        const result = await activity.loadLodgeActivity(client, lodge, now);
        const sections = Object.values(result);
        assert.equal(sections.filter((s) => s.state === 'error').length, 1);
        assert.equal(sections.filter((s) => s.rows.length === 1).length, 2);
        assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
      }
  });
  await check('malformed dates fail safely before rendering', async () => {
    rows.events[0].event_date = '2026-02-30';
    rows.achievements[0].created_at = 'invalid';
    const html = await render();
    assert.match(html, /Events could not be loaded/);
    assert.match(html, /Achievements could not be loaded/);
    assert.match(html, /Untitled Chronicle/);
  });
  await check('empty summaries render their individual empty states', async () => {
    for (const table of tables) rows[table] = [];
    const html = await render();
    assert.match(html, /Nothing is on the calendar/);
    assert.match(html, /No achievements have been recorded/);
    assert.match(html, /No Chronicles have been recorded/);
  });
  await check(
    'populated summaries render nullable-field fallbacks and semantic headings',
    async () => {
      const html = await render();
      assert.match(html, /Time to be arranged/);
      assert.match(html, /Recorded/);
      assert.match(html, /A photo accompanies this entry/);
      for (const section of ['events', 'achievements', 'chronicles'])
        assert.match(html, new RegExp(`aria-labelledby="${section}-heading"`));
    },
  );
  await check('user text is escaped and long excerpts are bounded', async () => {
    rows.events[0].title = '<script>alert(1)</script>';
    rows.chronicle_entries[0].body = 'x'.repeat(300);
    const html = await render();
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.equal(activity.excerpt(rows.chronicle_entries[0].body).length, 218);
    assert.equal(activity.activityDate('2026-09-17'), 'Sep 17, 2026');
  });
  await check('nonmembers never query activity', async () => {
    memberships = [];
    assert.equal(await LodgeActivity({ lodgeId: lodge }), null);
    assert.equal(calls.length, 0);
  });
  await check('authentication failure propagates rather than becoming empty content', async () => {
    authFailure = true;
    await assert.rejects(render(), /SIGN_IN/);
    assert.equal(calls.length, 0);
  });
  console.log(`${passed} activity checks passed.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
