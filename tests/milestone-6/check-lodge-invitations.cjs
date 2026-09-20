/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked Lodge invitation regression runner. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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
      require: (name) => (assert.ok(name in dependencies, name), dependencies[name]),
    },
  );
  return exports;
}

const invitations = load('src/lib/lodge-invitations.ts', {
  'server-only': {},
  'node:crypto': crypto,
  zod: require('zod'),
});
const lodgeId = '11111111-1111-4111-8111-111111111111';
let calls = [];
let rows = [];
const invitation = (overrides = {}) => ({
  id: '22222222-2222-4222-8222-222222222222',
  lodge_id: lodgeId,
  created_by: '33333333-3333-4333-8333-333333333333',
  email: 'traveler@example.com',
  role: 'member',
  expires_at: '2026-09-26T12:00:00.000Z',
  accepted_at: null,
  accepted_by: null,
  revoked_at: null,
  created_at: '2026-09-19T12:00:00.000Z',
  ...overrides,
});
const client = {
  from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'order', 'limit'])
      query[method] = (...args) => {
        calls.push([table, method, ...args]);
        return query;
      };
    query.then = (resolve, reject) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    return query;
  },
};

(async () => {
  const token = invitations.createInvitationToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    invitations.hashInvitationToken(token),
    crypto.createHash('sha256').update(token).digest('hex'),
  );

  calls = [];
  rows = [invitation()];
  const result = await invitations.loadLodgeInvitations(client, lodgeId);
  assert.equal(result[0].id, invitation().id);
  assert.ok(
    calls.some((call) => call[1] === 'eq' && call[2] === 'lodge_id' && call[3] === lodgeId),
  );
  assert.ok(calls.some((call) => call[1] === 'limit' && call[2] === 50));

  rows = [invitation({ role: 'owner' })];
  assert.equal(await invitations.loadLodgeInvitations(client, lodgeId), null);

  const migration = fs.readFileSync(
    'supabase/migrations/20260919050947_lodge_invitations_and_role_safety.sql',
    'utf8',
  );
  assert.match(migration, /token_hash text not null unique/);
  assert.doesNotMatch(migration, /raw_token/);
  assert.match(migration, /create or replace function public\.redeem_lodge_invitation/);
  assert.match(migration, /and role in \('caretaker', 'member', 'guest'\)/);
  assert.match(migration, /role <> 'owner'/);
  console.log('Lodge invitation checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
