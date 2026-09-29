/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused Guild authorization regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const actor = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const guild = '33333333-3333-4333-8333-333333333333';
const member = '44444444-4444-4444-8444-444444444444';
const rawMembership = {
  id: member,
  guild_id: guild,
  guilds: {
    id: guild,
    name: 'Test Guild',
    description: null,
    member_portal_enabled: false,
    created_by: actor,
  },
  guild_member_roles: [
    { role: 'guild_master', granted_at: '2026-09-01T00:00:00Z' },
    { role: 'officer', granted_at: '2026-09-01T00:00:00Z' },
  ],
};

function loadWithClaim(claim) {
  const exports = {};
  const query = (data) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      in: () => chain,
      then: (resolve) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return chain;
  };
  const supabase = {
    from: (table) => query(table === 'guild_members' ? [rawMembership] : claim ? [claim] : []),
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('src/lib/guilds.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require(name) {
        const dependencies = {
          'server-only': {},
          react: { cache: (fn) => fn },
          zod: require('zod'),
          '@/lib/hearth/context': { getViewer: async () => ({ supabase, user: { id: actor } }) },
        };
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return exports.getGuildMemberships();
}

(async () => {
  let [membership] = await loadWithClaim(null);
  assert.equal(membership.verified, false);
  assert.deepEqual(Array.from(membership.guild_member_roles), []);

  const baseClaim = {
    guild_id: guild,
    profile_id: actor,
    claimed_at: '2026-09-15T00:00:00Z',
    expires_at: '2099-09-22T00:00:00Z',
  };
  [membership] = await loadWithClaim(baseClaim);
  assert.equal(membership.verified, true);
  assert.deepEqual(
    Array.from(membership.guild_member_roles, ({ role }) => role),
    ['guild_master'],
  );

  [membership] = await loadWithClaim({ ...baseClaim, profile_id: other });
  assert.equal(membership.verified, true);
  assert.deepEqual(Array.from(membership.guild_member_roles), []);

  [membership] = await loadWithClaim({ ...baseClaim, expires_at: '2026-09-01T00:00:00Z' });
  assert.equal(membership.verified, false);
  assert.deepEqual(Array.from(membership.guild_member_roles), []);

  const migration = fs.readFileSync(
    'supabase/migrations/20260928190934_guild_verified_claim_gate.sql',
    'utf8',
  );
  assert.match(migration, /claim\.expires_at > now\(\)/);
  assert.match(migration, /claim\.profile_id = member\.profile_id/);
  assert.match(migration, /member_role\.granted_at >= claim\.claimed_at/);
  assert.match(
    migration,
    /revoke all on function public\.claim_verified_guild_master[\s\S]*from public, anon, authenticated/,
  );
  assert.match(migration, /revoke execute on function public\.accept_guild_ownership_transfer/);
  console.log('Guild verification gate checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
