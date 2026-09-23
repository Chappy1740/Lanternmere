/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked Guild foundation regression runner. */
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

const guilds = load('src/lib/guilds.ts', {
  'server-only': {},
  react: { cache: (fn) => fn },
  zod: require('zod'),
  '@/lib/hearth/context': { getViewer: async () => ({}) },
});

assert.equal(guilds.isGuildLeadership(['guild_master']), true);
assert.equal(guilds.isGuildLeadership(['officer', 'loot_council']), true);
assert.equal(guilds.isGuildLeadership(['raid_leader']), true);
assert.equal(guilds.isGuildLeadership(['loot_council']), false);
assert.equal(guilds.guildRoleLabel('guild_master'), 'Guild Master');
assert.equal(guilds.guildRoleLabel('loot_council'), 'Loot Council');
assert.equal(
  guilds.isGuildRosterSnapshotFresh('2026-09-23T00:00:00Z', Date.parse('2026-09-23T23:59:59Z')),
  true,
);
assert.equal(
  guilds.isGuildRosterSnapshotFresh('2026-09-22T00:00:00Z', Date.parse('2026-09-23T00:00:00Z')),
  false,
);

const sql = fs.readFileSync('supabase/migrations/20260922043253_guild_foundation.sql', 'utf8');
for (const table of [
  'guilds',
  'guild_members',
  'guild_member_roles',
  'guild_invitations',
  'guild_audit_events',
]) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
}
for (const fn of [
  'create_guild',
  'redeem_guild_invitation',
  'set_guild_member_portal',
  'is_guild_member',
  'has_guild_role',
  'can_manage_guild',
  'can_lead_guild',
])
  assert.match(sql, new RegExp(`function (?:public|private)\\.${fn}`));
assert.match(sql, /member_portal_enabled boolean not null default false/);
assert.match(sql, /revoke all on public\.guilds, public\.guild_members/);
assert.match(sql, /role in \('guild_master', 'officer', 'raid_leader', 'loot_council'\)/);
assert.doesNotMatch(sql, /references public\.lodges/);
assert.doesNotMatch(sql, /lodge_id/);
console.log('Guild foundation checks passed.');

const raidSql = fs.readFileSync(
  'supabase/migrations/20260923090723_guild_raid_operations.sql',
  'utf8',
);
for (const table of [
  'guild_raid_operations',
  'guild_raid_operation_members',
  'guild_raid_assignments',
]) {
  assert.match(raidSql, new RegExp(`create table public\\.${table}`));
  assert.match(raidSql, new RegExp(`alter table public\\.${table} enable row level security`));
}
assert.match(raidSql, /references public\.events\(id\)/);
assert.match(raidSql, /private\.is_lodge_admin\(event\.lodge_id\)/);
assert.match(raidSql, /event\.created_by = v_actor/);
assert.match(raidSql, /private\.can_lead_guild\(p_guild_id\)/);
assert.match(raidSql, /planning_status in \('selected', 'bench'\)/);
assert.match(raidSql, /raid_role in \('tank', 'healer', 'dps'\)/);
assert.match(raidSql, /list_guild_raid_operations/);
assert.match(raidSql, /guild\.raid_operation_authorized/);
console.log('Guild raid operation checks passed.');

const attendanceSql = fs.readFileSync(
  'supabase/migrations/20260923092223_guild_raid_attendance.sql',
  'utf8',
);
assert.match(attendanceSql, /create table public\.guild_raid_attendance/);
assert.match(attendanceSql, /alter table public\.guild_raid_attendance enable row level security/);
assert.match(
  attendanceSql,
  /attendance_status in \('invited', 'confirmed', 'attended', 'late', 'absent', 'benched'\)/,
);
assert.match(attendanceSql, /references public\.guild_raid_operations\(id\)/);
assert.match(attendanceSql, /private\.can_lead_guild\(v_guild_id\)/);
assert.match(attendanceSql, /guild\.raid_attendance_recorded/);
assert.match(attendanceSql, /revoke all on public\.guild_raid_attendance from anon, authenticated/);
console.log('Guild raid attendance checks passed.');

const rosterFailureSql = fs.readFileSync(
  'supabase/migrations/20260923100807_guild_roster_refresh_failures.sql',
  'utf8',
);
assert.match(rosterFailureSql, /function public\.record_guild_roster_refresh_failure/);
assert.match(rosterFailureSql, /private\.can_manage_guild\(p_guild_id\)/);
assert.match(rosterFailureSql, /set failure_message = btrim\(p_failure_message\)/);
assert.match(rosterFailureSql, /guild\.official_roster_refresh_failed/);
assert.match(
  rosterFailureSql,
  /revoke all on function public\.record_guild_roster_refresh_failure/,
);
console.log('Guild roster refresh-failure checks passed.');
