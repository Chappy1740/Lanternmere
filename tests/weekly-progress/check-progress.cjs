/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked weekly progress security and calculation checks. */
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
const { buildProgressRows, parseRunLevels, weeklyReportSchema } = load(
  'src/lib/weekly-raider-progress.ts',
);
const { parseWeeklyMythicRuns } = load('src/lib/wow/weekly-mythic-runs.ts');
const { weeklyResetForRegion } = load('src/lib/war-table.ts');
const now = Date.parse('2026-10-26T18:00:00Z');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const character = {
  id: uuid(1),
  profile_id: uuid(2),
  character_name: 'Example',
  realm_slug: 'realm',
  region: 'us',
  class: 'Rogue',
  character_snapshots: [
    {
      source: 'blizzard',
      last_refreshed_at: '2026-10-26T16:00:00Z',
      snapshot_data: {
        equipped_item_level: 328,
        equipment: [],
        raid_encounters: [
          {
            raid: 'Current raid',
            difficulty: 'Heroic',
            boss: 'Boss',
            last_kill_at: '2026-10-25T17:00:00Z',
          },
          {
            raid: 'Old raid',
            difficulty: 'Heroic',
            boss: 'Old boss',
            last_kill_at: '2026-10-19T17:00:00Z',
          },
          {
            raid: 'Current raid',
            difficulty: 'Heroic',
            boss: 'Boss',
            last_kill_at: '2026-10-25T17:00:00Z',
          },
        ],
        weekly_mythic_runs: [
          { level: 10, dungeon: 'Dungeon', completedAt: '2026-10-25T17:00:00Z' },
        ],
      },
    },
  ],
};
const report = {
  id: uuid(3),
  character_id: character.id,
  reset_on: '2026-10-27',
  mythic_run_levels: [10, 10, 10, 10, 10, 10],
  weekly_raid_bosses: 6,
  raid_vault_slots: 2,
  dungeon_vault_slots: 2,
  world_vault_slots: null,
  reported_at: '2026-10-26T17:00:00Z',
};
const requirement = {
  id: uuid(4),
  mythic_runs_required: 8,
  minimum_key_level: 10,
  raid_bosses_required: null,
  updated_at: '2026-10-26T16:00:00Z',
};
const base = {
  members: [{ id: uuid(5), profile_id: uuid(2), name: 'Member' }],
  characters: [character],
  reports: [report],
  requirement,
  selection: null,
  region: 'us',
  resetOn: '2026-10-27',
  weekStartsAt: '2026-10-20T15:00:00Z',
  weekEndsAt: '2026-10-27T15:00:00Z',
  now,
};
let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
const row = (changes = {}) => buildProgressRows({ ...base, ...changes })[0];
check('eight required, six completed: two remain', () => {
  assert.equal(row().completed, 6);
  assert.equal(row().remaining, 2);
  assert.equal(row().status, 'remaining');
});
check('key minimum filters each run, including repeated dungeon runs', () => {
  assert.equal(row({ reports: [{ ...report, mythic_run_levels: [9, 10, 11, 2] }] }).completed, 2);
});
check('eight qualifying runs meet target without inferring Vault slots', () => {
  const r = row({
    reports: [{ ...report, mythic_run_levels: Array(8).fill(10), dungeon_vault_slots: null }],
  });
  assert.equal(r.status, 'met');
  assert.equal(r.remaining, 0);
  assert.equal(r.vault.dungeon, null);
});
check('missing report stays unknown despite observed runs and boss kills', () => {
  const r = row({ reports: [] });
  assert.equal(r.completed, null);
  assert.equal(r.remaining, null);
  assert.equal(r.bosses, null);
  assert.equal(r.status, 'unknown');
  assert.equal(r.observedRuns.length, 1);
});
check('explicit zero differs from blank unknown', () => {
  assert.equal(row({ reports: [{ ...report, mythic_run_levels: [] }] }).completed, 0);
  assert.equal(row({ reports: [{ ...report, mythic_run_levels: null }] }).completed, null);
  assert.equal(parseRunLevels(''), null);
  assert.equal(parseRunLevels('none').length, 0);
});
check('invalid or oversized level lists are rejected', () => {
  for (const input of [
    '0',
    '1',
    '41',
    '10.5',
    'NaN',
    '2e1',
    '<script>',
    Array(101).fill(10).join(','),
  ])
    assert.equal(parseRunLevels(input), undefined, input);
  assert.equal(parseRunLevels('10, 10 11').length, 3);
});
check('old-week, future and invalid recording dates never count as current', () => {
  for (const reported_at of ['2026-10-19T17:00:00Z', '2026-10-27T17:00:00Z', 'invalid'])
    assert.equal(row({ reports: [{ ...report, reported_at }] }).completed, null);
  assert.equal(row({ reports: [{ ...report, reset_on: '2026-10-20' }] }).completed, null);
});
check('24-hour old target completion requests an update', () => {
  assert.equal(
    row({
      reports: [
        { ...report, mythic_run_levels: Array(8).fill(10), reported_at: '2026-10-25T17:00:00Z' },
      ],
    }).status,
    'stale',
  );
});
check('raid target participates in completion and unknown handling', () => {
  const changes = {
    requirement: { ...requirement, raid_bosses_required: 8 },
    reports: [{ ...report, mythic_run_levels: Array(8).fill(10) }],
  };
  assert.equal(row(changes).status, 'remaining');
  assert.equal(
    row({ ...changes, reports: [{ ...changes.reports[0], weekly_raid_bosses: null }] }).status,
    'unknown',
  );
});
check('zero required raid kills does not require a known boss total', () => {
  const r = row({
    requirement: { ...requirement, raid_bosses_required: 0 },
    reports: [{ ...report, mythic_run_levels: Array(8).fill(10), weekly_raid_bosses: null }],
  });
  assert.equal(r.status, 'met');
});
check('no target does not imply completed', () =>
  assert.equal(row({ requirement: null }).status, 'no_target'),
);
check('weekly observed kills deduplicate and exclude prior reset', () =>
  assert.equal(row().observedBosses.length, 1),
);
check('unshared character stays an unknown roster member', () => {
  const r = row({ characters: [] });
  assert.equal(r.character, null);
  assert.equal(r.completed, null);
  assert.equal(r.equipment.length, 0);
});
check('raid roster selects exact character and preserves bench', () => {
  const selection = [
    {
      guild_member_id: uuid(5),
      character_id: uuid(88),
      planning_status: 'bench',
      raid_role: 'healer',
    },
  ];
  const r = row({ selection });
  assert.equal(r.character, null);
  assert.equal(r.bench, true);
  assert.equal(buildProgressRows({ ...base, selection: [] }).length, 0);
});
check('another member or region cannot supply a selected character', () => {
  assert.equal(row({ characters: [{ ...character, profile_id: uuid(90) }] }).character, null);
  assert.equal(row({ characters: [{ ...character, region: 'eu' }] }).character, null);
});
check('missing optional details cannot erase valid item level', () =>
  assert.equal(
    row({
      characters: [
        {
          ...character,
          character_snapshots: [
            {
              ...character.character_snapshots[0],
              snapshot_data: { equipped_item_level: 328, equipment: 'broken' },
            },
          ],
        },
      ],
    }).itemLevel,
    328,
  ),
);
check('latest valid Blizzard snapshot selected; other sources not trusted', () => {
  const snapshots = [
    {
      source: 'other',
      last_refreshed_at: '2026-10-26T17:00:00Z',
      snapshot_data: { equipped_item_level: 999 },
    },
    ...character.character_snapshots,
  ];
  assert.equal(
    row({ characters: [{ ...character, character_snapshots: snapshots }] }).itemLevel,
    328,
  );
});
check('slot count ranges and malformed reports rejected', () => {
  assert.equal(weeklyReportSchema.safeParse(report).success, true);
  assert.equal(weeklyReportSchema.safeParse({ ...report, dungeon_vault_slots: 4 }).success, false);
});
check('optional best-runs payload deduplicates but does not claim completeness', () => {
  const run = {
    completed_timestamp: now - 1000,
    keystone_level: 10,
    dungeon: { id: 1, name: 'Dungeon' },
  };
  assert.equal(parseWeeklyMythicRuns({ current_period: { best_runs: [run, run] } }).length, 1);
  assert.equal(parseWeeklyMythicRuns({ current_period: {} }), null);
  assert.equal(
    parseWeeklyMythicRuns({
      current_period: { best_runs: [{ ...run, completed_timestamp: 1e100 }] },
    }),
    null,
  );
});
check('US reset windows honor DST, EU fixed UTC and exact boundary', () => {
  assert.equal(
    weeklyResetForRegion('us', new Date('2026-11-03T15:59:59Z')).at,
    '2026-11-03T16:00:00.000Z',
  );
  assert.equal(weeklyResetForRegion('us', new Date('2026-11-03T16:00:00Z')).isoDate, '2026-11-10');
  assert.equal(
    weeklyResetForRegion('eu', new Date('2026-10-28T03:59:59Z')).at,
    '2026-10-28T04:00:00.000Z',
  );
  assert.equal(weeklyResetForRegion('kr'), null);
});
console.log(`${checks} weekly progress calculation/boundary groups passed.`);
