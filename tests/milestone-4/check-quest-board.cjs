/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked Quest Board regression runner. */
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

const events = load('src/lib/quest-board/events.ts', { 'server-only': {}, zod: require('zod') });
const lodge = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const profileId = '33333333-3333-4333-8333-333333333333';
let calls = [];
let rows = {};

const client = {
  from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'gte', 'lt', 'order', 'limit'])
      query[method] = (...args) => {
        calls.push([table, method, ...args]);
        return query;
      };
    query.maybeSingle = () => Promise.resolve({ data: rows.event, error: null });
    query.then = (resolve, reject) =>
      Promise.resolve({ data: rows[table], error: null }).then(resolve, reject);
    return query;
  },
};

function event() {
  return {
    id: eventId,
    lodge_id: lodge,
    created_by: profileId,
    title: 'The Glass Citadel',
    activity_type: 'Raid',
    event_date: '2026-09-18',
    event_time: '19:30:00',
    difficulty: 'Heroic',
    notes: null,
  };
}

let passed = 0;
async function check(label, run) {
  calls = [];
  rows = { events: [event()], event: event(), event_attendees: [] };
  await run();
  passed++;
  console.log(`PASS: ${label}`);
}

(async () => {
  await check('upcoming and past queries are both scoped to the selected Lodge', async () => {
    const result = await events.loadQuestBoard(client, lodge, '2026-09-17');
    assert.equal(result.upcoming[0].id, eventId);
    assert.ok(
      calls
        .filter((call) => call[0] === 'events' && call[1] === 'eq')
        .every((call) => call[2] === 'lodge_id' && call[3] === lodge),
    );
    assert.ok(
      calls.some(
        (call) => call[1] === 'gte' && call[2] === 'event_date' && call[3] === '2026-09-17',
      ),
    );
    assert.ok(
      calls.some(
        (call) => call[1] === 'lt' && call[2] === 'event_date' && call[3] === '2026-09-17',
      ),
    );
    assert.ok(calls.some((call) => call[1] === 'limit' && call[2] === 12));
  });
  await check('detail reads require both event and selected Lodge identifiers', async () => {
    await events.loadEventDetail(client, eventId, lodge);
    assert.ok(
      calls.some(
        (call) =>
          call[0] === 'events' && call[1] === 'eq' && call[2] === 'id' && call[3] === eventId,
      ),
    );
    assert.ok(
      calls.some(
        (call) =>
          call[0] === 'events' && call[1] === 'eq' && call[2] === 'lodge_id' && call[3] === lodge,
      ),
    );
    assert.ok(
      calls.some(
        (call) =>
          call[0] === 'event_attendees' &&
          call[1] === 'eq' &&
          call[2] === 'event_id' &&
          call[3] === eventId,
      ),
    );
  });
  await check('malformed event or attendee data fails safely', async () => {
    rows.events = [{ ...event(), event_date: 'not-a-date' }];
    rows.event_attendees = [
      { id: eventId, profile_id: profileId, rsvp_status: 'invalid', role: null, profiles: null },
    ];
    const board = await events.loadQuestBoard(client, lodge, '2026-09-17');
    const detail = await events.loadEventDetail(client, eventId, lodge);
    assert.equal(board.upcoming, null);
    assert.equal(detail.attendees, null);
  });
  await check('date display keeps the established UTC convention', async () => {
    assert.match(events.eventDateTime(event()), /September 18, 2026 at 19:30/);
    assert.match(events.eventDateTime({ ...event(), event_time: null }), /time to be arranged/);
  });
  await check('RLS migration freezes event identity and protects RSVP ownership', async () => {
    const sql = fs.readFileSync(
      'supabase/migrations/20260917140026_harden_event_boundaries.sql',
      'utf8',
    );
    assert.match(sql, /new\.lodge_id is distinct from old\.lodge_id/);
    assert.match(sql, /new\.created_by is distinct from old\.created_by/);
    assert.match(sql, /private\.can_read_event\(event_id\)/);
    assert.match(sql, /character_id is null or private\.owns_character\(character_id\)/);
    assert.match(sql, /to authenticated/);
  });
  console.log(`${passed} Quest Board checks passed.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
