/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused mocked Raider.IO audit regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, dependencies, globals = {}) {
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
      URL,
      URLSearchParams,
      AbortSignal,
      FormData,
      Date,
      ...globals,
    },
  );
  return exports;
}

const characterId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const lodgeId = '33333333-3333-4333-8333-333333333333';
const character = {
  id: characterId,
  character_name: 'Audittraveler',
  realm_slug: 'stormrage',
  region: 'us',
};
let claimed = true;
let fetchResult;
let fetchCalls = 0;
let attemptFailure = null;
let savedSnapshot = null;
let verifiedOwner = true;

const serverClient = {
  auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  from(table) {
    assert.equal(table, 'characters');
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: verifiedOwner ? character : null, error: null }),
    };
  },
};
const adminClient = {
  rpc: async (name, args) => {
    assert.equal(name, 'claim_raiderio_refresh');
    assert.equal(args.p_character_id, characterId);
    return { data: claimed, error: null };
  },
  from(table) {
    return {
      update(value) {
        if (table === 'character_raiderio_refresh_attempts') attemptFailure = value.failure_message;
        return this;
      },
      eq: async () => ({ error: null }),
      upsert: async (value) => {
        assert.equal(table, 'character_raiderio_snapshots');
        savedSnapshot = value;
        return { error: null };
      },
    };
  },
};
const actions = load('src/app/(app)/travelers/[id]/actions.ts', {
  'next/cache': { revalidatePath() {} },
  zod: require('zod'),
  '@/lib/raiderio': {
    fetchRaiderIoProgress: async () => {
      fetchCalls += 1;
      return fetchResult;
    },
  },
  '@/lib/supabase/admin': { createAdminClient: () => adminClient },
  '@/lib/supabase/server': { createClient: async () => serverClient },
});
function form() {
  const data = new FormData();
  data.set('characterId', characterId);
  return data;
}

(async () => {
  const insecureReport = new FormData();
  insecureReport.set('characterId', characterId);
  insecureReport.set('lodgeId', lodgeId);
  insecureReport.set('reportUrl', 'http://raidbots.com/simbot/report/audit');
  let result = await actions.saveRaidbotsReport({}, insecureReport);
  assert.match(result.error, /Raidbots report link/);
  console.log('PASS: insecure Raidbots URLs fail before the database write');

  claimed = false;
  result = await actions.refreshRaiderIo({}, form());
  assert.match(result.error, /once every 24 hours/);
  assert.equal(fetchCalls, 0);
  console.log('PASS: failed claim prevents a second upstream request');

  claimed = true;
  fetchResult = { ok: false, message: 'Raider.IO is busy. Please wait and try again later.' };
  result = await actions.refreshRaiderIo({}, form());
  assert.equal(result.error, fetchResult.message);
  assert.equal(attemptFailure, fetchResult.message);
  assert.equal(fetchCalls, 1);
  console.log('PASS: first upstream failure is retained for the leader view');

  fetchResult = {
    ok: true,
    score: 1234,
    raidProgression: {},
    sourceUrl: 'https://raider.io/characters/us/stormrage/Audittraveler',
  };
  result = await actions.refreshRaiderIo({}, form());
  assert.match(result.success, /refreshed/);
  assert.equal(savedSnapshot.character_id, characterId);
  console.log('PASS: successful owner refresh saves the snapshot');

  verifiedOwner = false;
  result = await actions.refreshRaiderIo({}, form());
  assert.match(result.error, /your own Traveler/);
  assert.equal(fetchCalls, 2);
  console.log('PASS: unverified owner cannot claim or fetch');

  let responseUrl = 'https://raider.io/characters/us/stormrage/Audittraveler';
  let capturedSignal = null;
  const parser = load(
    'src/lib/raiderio.ts',
    {
      'server-only': {},
      zod: require('zod'),
    },
    {
      fetch: async (_url, options) => {
        capturedSignal = options.signal;
        return {
          ok: true,
          status: 200,
          json: async () => ({ profile_url: responseUrl, mythic_plus_scores_by_season: [] }),
        };
      },
    },
  );
  const input = { region: 'us', realm: 'stormrage', characterName: 'Audittraveler' };
  assert.equal((await parser.fetchRaiderIoProgress(input)).ok, true);
  assert.ok(capturedSignal);
  responseUrl = 'https://evilraider.io/characters/audit';
  assert.equal((await parser.fetchRaiderIoProgress(input)).ok, false);
  responseUrl = 'http://raider.io/characters/audit';
  assert.equal((await parser.fetchRaiderIoProgress(input)).ok, false);
  console.log('PASS: parser requires HTTPS Raider.IO hosts and sets a timeout');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
