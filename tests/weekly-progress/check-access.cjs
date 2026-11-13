/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Synthetic action, loader and page access checks. */
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load.cjs');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = Date.parse('2026-10-26T18:00:00Z');
class Clock extends Date {
  constructor(...args) {
    super(...(args.length ? args : [NOW]));
  }
  static now() {
    return NOW;
  }
}
let user, memberships, character, rpcError, rpcCalls, revalidated, queries;
function reset() {
  user = { id: id(1) };
  memberships = [
    {
      guild_id: id(2),
      verified: true,
      guild_member_roles: [{ role: 'raid_leader' }],
      guilds: { name: 'Test Guild' },
    },
  ];
  character = { id: id(3), region: 'us' };
  rpcError = null;
  rpcCalls = [];
  revalidated = [];
  queries = [];
}
// Chainable PostgREST fixture: records every filter, never contacts a database.
function makeQuery(table, result) {
  const record = { table, calls: [] };
  queries.push(record);
  let proxy;
  proxy = new Proxy(
    {},
    {
      get(_target, name) {
        if (name === 'then') return (resolve) => Promise.resolve(result).then(resolve);
        return (...args) => {
          record.calls.push([name, ...args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}
const supabase = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from: (table) => makeQuery(table, { data: character, error: null }),
  rpc: async (name, args) => {
    rpcCalls.push({ name, args });
    return { error: rpcError };
  },
};
const guildMock = {
  getGuildMemberships: async () => memberships,
  isGuildLeadership: (roles) =>
    roles.some((role) => ['guild_master', 'officer', 'raid_leader'].includes(role)),
};
const actions = load(
  'src/app/(app)/guild-hall/progress/actions.ts',
  {
    'next/cache': { revalidatePath: (path) => revalidated.push(path) },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/guilds': guildMock,
  },
  { Date: Clock },
);
function form(extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    guildId: id(2),
    operationId: '',
    region: 'us',
    resetOn: '2026-10-27',
    runs: '8',
    minimumKey: '10',
    raidBosses: '',
    ...extra,
  }))
    data.set(key, value);
  return data;
}
function reportForm(extra = {}) {
  return form({
    characterId: id(3),
    runLevels: '10,10,10,10,10,10',
    bosses: '6',
    raidSlots: '2',
    dungeonSlots: '2',
    worldSlots: '',
    ...extra,
  });
}
let checks = 0;
async function check(name, fn) {
  reset();
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
(async () => {
  await check('leaders save exact weekly scope and minimum key', async () => {
    assert.equal((await actions.saveWeeklyRequirement({}, form())).error, false);
    assert.equal(rpcCalls[0].args.p_mythic_runs_required, 8);
    assert.equal(rpcCalls[0].args.p_operation_id, null);
    assert.equal(rpcCalls[0].args.p_raid_bosses_required, null);
  });
  await check('members, expired claims and foreign Guild IDs cannot save targets', async () => {
    for (const changes of [{ guild_member_roles: [] }, { verified: false }, { guild_id: id(9) }]) {
      memberships = [{ ...memberships[0], ...changes }];
      assert.equal((await actions.saveWeeklyRequirement({}, form())).error, true);
    }
    assert.equal(rpcCalls.length, 0);
  });
  await check('old reset and invalid input stop before writes', async () => {
    for (const extra of [
      { resetOn: '2026-10-20' },
      { region: 'kr' },
      { runs: '' },
      { minimumKey: '41' },
      { operationId: 'foreign' },
    ])
      assert.equal((await actions.saveWeeklyRequirement({}, form(extra))).error, true);
    assert.equal(rpcCalls.length, 0);
  });
  await check('unauthenticated target save stops before RPC', async () => {
    user = null;
    assert.equal((await actions.saveWeeklyRequirement({}, form())).error, true);
    assert.equal(rpcCalls.length, 0);
  });
  await check('report uses server-owned character and defaults private', async () => {
    assert.equal((await actions.saveWeeklyReport({}, reportForm())).error, false);
    assert.equal(rpcCalls[0].args.p_character_id, character.id);
    assert.equal(rpcCalls[0].args.p_shared, false);
    assert.equal(rpcCalls[0].args.p_world_vault_slots, null);
    assert.equal(rpcCalls[0].args.p_mythic_run_levels.length, 6);
    assert.ok(
      queries[0].calls.some(
        ([method, column, value]) =>
          method === 'eq' && column === 'profile_id' && value === user.id,
      ),
    );
  });
  await check('foreign character and sign-out block reporting', async () => {
    character = null;
    assert.equal((await actions.saveWeeklyReport({}, reportForm())).error, true);
    user = null;
    assert.equal((await actions.saveWeeklyReport({}, reportForm())).error, true);
    assert.equal(rpcCalls.length, 0);
  });
  await check('invalid counts and unsupported or wrong week cannot save', async () => {
    for (const extra of [
      { dungeonSlots: '4' },
      { bosses: '-1' },
      { runLevels: '1,10' },
      { resetOn: '2026-10-20' },
    ])
      assert.equal((await actions.saveWeeklyReport({}, reportForm(extra))).error, true);
    character.region = 'kr';
    assert.equal((await actions.saveWeeklyReport({}, reportForm())).error, true);
    assert.equal(rpcCalls.length, 0);
  });
  await check('RPC access/constraint errors are safe failures without revalidation', async () => {
    rpcError = { message: 'PRIVATE_DATABASE_SENTINEL' };
    const result = await actions.saveWeeklyReport({}, reportForm({ shared: 'on' }));
    assert.equal(result.error, true);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_DATABASE_SENTINEL'));
    assert.equal(revalidated.length, 0);
  });
  await check('shared loader filters Guild consent before reading reports', async () => {
    const loader = load('src/lib/guild-weekly-progress.ts', {
      '@/lib/hearth/context': {
        getViewer: async () => ({
          supabase: { from: (table) => makeQuery(table, { data: [], error: null }) },
        }),
      },
    });
    assert.ok(await loader.loadSharedWeeklyProgress(id(2), 'us', '2026-10-27'));
    for (const record of queries) {
      assert.ok(
        record.calls.some(
          ([method, column, value]) =>
            method === 'eq' && column.endsWith('guild_id') && value === id(2),
        ),
      );
    }
    const shared = queries.find((entry) => entry.table === 'guild_vault_sharing');
    assert.ok(
      shared.calls.some(
        ([method, column, value]) =>
          method === 'eq' && column === 'weekly_vault_progress.reset_on' && value === '2026-10-27',
      ),
    );
    assert.ok(!queries.some((entry) => entry.table === 'weekly_vault_progress'));
  });
  await check('shared loader fails closed on database error or truncated results', async () => {
    const loader = load('src/lib/guild-weekly-progress.ts', {
      '@/lib/hearth/context': {
        getViewer: async () => ({
          supabase: {
            from: (table) => makeQuery(table, { data: [], error: { message: 'error' } }),
          },
        }),
      },
    });
    assert.equal(await loader.loadSharedWeeklyProgress(id(2), 'us', '2026-10-27'), null);
  });
  await check('ordinary member page never requests team or officer records', async () => {
    memberships[0].guild_member_roles = [];
    const forbidden = async () => {
      throw new Error('LEADERSHIP_READ_FOR_MEMBER');
    };
    const Page = load(
      'src/app/(app)/guild-hall/progress/page.tsx',
      {
        '@/lib/guilds': {
          ...guildMock,
          loadGuildMembers: forbidden,
          loadGuildRaidOperations: forbidden,
        },
        '@/lib/guild-weekly-progress': {
          loadSharedWeeklyProgress: forbidden,
          loadWeeklyRequirement: async () => ({ ok: true, requirement: null }),
          loadOwnWeeklyProgress: async () => ({ characters: [], reports: [], sharedIds: [] }),
        },
        '@/components/guild-weekly-progress-forms': {
          WeeklyReportForm: () => null,
          WeeklyRequirementForm: () => null,
        },
        '@/components/guild-weekly-progress-board': {
          GuildWeeklyProgressBoard: () => {
            throw new Error('PRIVATE_BOARD');
          },
        },
        'next/navigation': {
          notFound: () => {
            throw new Error('NOT_FOUND');
          },
        },
        'next/link': { default: ({ children }) => React.createElement('span', null, children) },
      },
      { Date: Clock },
    ).default;
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ guild: id(2) }) }),
    );
    assert.match(html, /Your Guild/);
    assert.ok(!html.includes('Weekly raider progress'));
    for (const params of [
      { guild: id(90) },
      { guild: [id(2)] },
      { operation: id(10) },
      { region: 'kr' },
    ])
      await assert.rejects(() => Page({ searchParams: Promise.resolve(params) }), /NOT_FOUND/);
  });
  await check('owner loader separates this Guild sharing from other Guild sharing', async () => {
    const report = {
      id: id(30),
      character_id: id(3),
      reset_on: '2026-10-27',
      mythic_run_levels: null,
      weekly_raid_bosses: null,
      raid_vault_slots: null,
      dungeon_vault_slots: null,
      world_vault_slots: null,
      reported_at: null,
    };
    const fixtures = {
      characters: [
        { id: id(3), character_name: 'Example', realm_slug: 'realm', character_guild_sharing: [] },
      ],
      weekly_vault_progress: [report],
      guild_vault_sharing: [
        { vault_progress_id: report.id, guild_id: id(2) },
        { vault_progress_id: report.id, guild_id: id(9) },
      ],
    };
    const loader = load('src/lib/guild-weekly-progress.ts', {
      '@/lib/hearth/context': {
        getViewer: async () => ({
          user,
          supabase: { from: (table) => makeQuery(table, { data: fixtures[table], error: null }) },
        }),
      },
    });
    const result = await loader.loadOwnWeeklyProgress(id(2), 'us', '2026-10-27');
    assert.equal(result.sharedIds[0], report.id);
    assert.equal(result.sharedElsewhereIds[0], report.id);
    assert.ok(
      queries.every((record) =>
        record.calls.some(
          ([method, column, value]) =>
            method === 'eq' && column === 'profile_id' && value === user.id,
        ),
      ),
    );
  });
  console.log(
    `${checks} weekly progress action/access groups passed. No credentials, network or database used.`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
