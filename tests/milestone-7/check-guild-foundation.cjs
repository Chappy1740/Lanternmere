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
