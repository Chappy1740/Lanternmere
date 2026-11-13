/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Synthetic own-sharing row-cap regression check. */
// Own-report sharing is looked up only for this week's records, so long sharing
// history can never push the page past its fail-closed row cap.
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = { id: uuid(1) };
const guild = uuid(2);
const otherGuild = uuid(3);
const thisWeek = uuid(500);
function fake(rowsFor, calls) {
  return {
    from(table) {
      const query = {
        filters: [],
        select() {
          return query;
        },
        eq(key, value) {
          query.filters.push(['eq', key, value]);
          return query;
        },
        in(key, values) {
          query.filters.push(['in', key, values]);
          return query;
        },
        order() {
          return query;
        },
        limit(max) {
          query.max = max;
          return query;
        },
        then(resolve, reject) {
          calls.push({ table, filters: query.filters });
          const rows = rowsFor(table, query.filters).slice(0, query.max ?? Infinity);
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}
const report = {
  id: thisWeek,
  character_id: uuid(10),
  reset_on: '2026-11-03',
  mythic_run_levels: [10],
  weekly_raid_bosses: null,
  raid_vault_slots: null,
  dungeon_vault_slots: null,
  world_vault_slots: null,
  reported_at: '2026-10-28T12:00:00Z',
};
async function run(historyRows, reports) {
  const calls = [];
  const supabase = fake((table, filters) => {
    if (table === 'characters')
      return [
        {
          id: uuid(10),
          character_name: 'Raider',
          realm_slug: 'realm',
          character_guild_sharing: [{ guild_id: guild }],
        },
      ];
    if (table === 'weekly_vault_progress') return reports;
    if (table === 'guild_vault_sharing') {
      const history = Array.from({ length: historyRows }, (_, i) => ({
        vault_progress_id: uuid(1000 + i),
        guild_id: guild,
      }));
      const all = [
        ...history,
        { vault_progress_id: thisWeek, guild_id: guild },
        { vault_progress_id: thisWeek, guild_id: otherGuild },
      ];
      const ids = filters.find(([op, key]) => op === 'in' && key === 'vault_progress_id')?.[2];
      return ids ? all.filter((row) => ids.includes(row.vault_progress_id)) : all;
    }
    return [];
  }, calls);
  const mod = load('src/lib/guild-weekly-progress.ts', {
    '@/lib/hearth/context': { getViewer: async () => ({ supabase, user }) },
  });
  return { result: await mod.loadOwnWeeklyProgress(guild, 'us', '2026-11-03'), calls };
}
(async () => {
  const heavy = await run(5000, [report]);
  assert.ok(heavy.result, 'Long sharing history must not make the page unavailable');
  assert.deepEqual([...heavy.result.sharedIds], [thisWeek]);
  assert.deepEqual([...heavy.result.sharedElsewhereIds], [thisWeek]);
  const sharingCall = heavy.calls.find((call) => call.table === 'guild_vault_sharing');
  assert.ok(
    sharingCall.filters.some(([op, key]) => op === 'in' && key === 'vault_progress_id'),
    'Sharing lookup is scoped to this week',
  );
  const none = await run(5000, []);
  assert.ok(none.result);
  assert.equal(
    none.calls.some((call) => call.table === 'guild_vault_sharing'),
    false,
    'No sharing query without reports',
  );
  console.log('Own weekly sharing lookup: week-scoped and bounded.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
