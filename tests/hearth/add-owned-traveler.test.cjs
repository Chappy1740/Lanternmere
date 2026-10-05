/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Standalone action regression runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../src/app/(app)/account/actions.ts'),
  'utf8',
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const owner = '11111111-1111-4111-8111-111111111111';
const traveler = '22222222-2222-4222-8222-222222222222';
const snapshot = {
  region: 'us',
  refreshed_at: new Date().toISOString(),
  characters: [{ id: 777, name: 'Wrenx', level: 90, realm: { slug: 'stormrage' } }],
};
const profile = { id: 777, name: 'Wrenx', realm: { slug: 'stormrage' }, level: 90 };
let requestedMain = true;
let fetchedProfile = profile;
let rpcError = null;
let calls = [];
let fetches = 0;
const supabase = {
  from(table) {
    const query = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      async maybeSingle() {
        return table === 'app_owned_wow_snapshots'
          ? { data: snapshot, error: null }
          : { data: { is_main: requestedMain }, error: null };
      },
    };
    return query;
  },
};
const dependencies = {
  'next/cache': { revalidatePath() {} },
  'next/navigation': {
    redirect: (location) => {
      throw new Error(`REDIRECT:${location}`);
    },
  },
  zod: { z },
  '@/lib/hearth/context': { getViewer: async () => ({ supabase, user: { id: owner } }) },
  '@/lib/account-nickname': { gameNicknameSchema: z.string() },
  '@/lib/supabase/admin': {
    createAdminClient: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return name === 'claim_wow_profile_fetch'
          ? { data: true, error: null }
          : { data: traveler, error: rpcError };
      },
    }),
  },
  '@/lib/wow/character-profile': {
    fetchCharacterProfile: async () => {
      fetches++;
      return {
        ok: true,
        profile: fetchedProfile,
        region: 'us',
        fetchedAt: new Date().toISOString(),
      };
    },
  },
  '@/lib/wow/guild-claim': {
    ownedWowCharacterSchema: z.object({
      id: z.number().int().positive(),
      name: z.string(),
      level: z.number().int(),
      realm: z.object({ slug: z.string() }),
    }),
  },
  '@/lib/wow/level': { WOW_MIN_TRAVELER_LEVEL: 80 },
};
const moduleExports = {};
vm.runInNewContext(code, {
  exports: moduleExports,
  Date,
  require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  },
});
const { addOwnedTraveler } = moduleExports;
function form(id = 777) {
  const data = new FormData();
  data.set('characterId', String(id));
  data.set('profileId', 'attacker-supplied-owner');
  return data;
}
async function check(name, run) {
  calls = [];
  fetches = 0;
  fetchedProfile = profile;
  rpcError = null;
  requestedMain = true;
  await run();
  console.log(`PASS: ${name}`);
}

(async () => {
  await check('a verified Main opens the Hearth', async () => {
    await assert.rejects(addOwnedTraveler({}, form()), /REDIRECT:\/hearth/);
    assert.equal(calls[1].name, 'claim_owned_wow_character');
    assert.equal(calls[1].args.p_profile_id, owner);
    assert.equal(fetches, 1);
  });
  await check('a verified alternate opens its Traveler page', async () => {
    requestedMain = false;
    await assert.rejects(
      addOwnedTraveler({}, form()),
      new RegExp(`REDIRECT:/travelers/${traveler}`),
    );
  });
  await check('a character absent from the private account list is rejected', async () => {
    assert.match((await addOwnedTraveler({}, form(778))).error, /not available/);
    assert.equal(calls.length, 0);
    assert.equal(fetches, 0);
  });
  await check('a mismatched public profile cannot be claimed', async () => {
    fetchedProfile = { ...profile, id: 778 };
    assert.match((await addOwnedTraveler({}, form())).error, /different character/);
    assert.equal(calls.length, 1);
  });
  await check('an exclusive claim conflict is reported without redirect', async () => {
    rpcError = { code: '23505' };
    assert.match((await addOwnedTraveler({}, form())).error, /already been claimed/);
  });
  console.log('5 Hearth action checks passed. No live network or credentials used.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
