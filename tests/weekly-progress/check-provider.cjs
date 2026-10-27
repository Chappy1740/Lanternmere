/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Real profile client with synthetic HTTP responses. */
const assert = require('node:assert/strict');
const { load } = require('./load.cjs');
let mode = 'success';
const calls = [];
const profile = {
  id: 7,
  name: 'Example',
  realm: { id: 1, name: 'Realm', slug: 'realm' },
  level: 90,
  character_class: { id: 4, name: 'Rogue' },
  race: { id: 1, name: 'Human' },
  faction: { type: 'ALLIANCE', name: 'Alliance' },
};
const { fetchCharacterProfile } = load(
  'src/lib/wow/character-profile.ts',
  {
    './blizzard-token': { getBlizzardToken: async () => 'SYNTHETIC_TEST_TOKEN' },
  },
  {
    fetch: async (url, options) => {
      calls.push(String(url));
      assert.equal(url.origin, 'https://us.api.blizzard.com');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal);
      if (url.pathname.endsWith('/mythic-keystone-profile')) {
        if (mode === 'timeout') throw new Error('synthetic timeout');
        if (mode === 'unavailable') return new Response('', { status: 404 });
        if (mode === 'malformed')
          return Response.json({ current_period: { best_runs: [{ keystone_level: 'bad' }] } });
        return Response.json({
          current_period: {
            best_runs: [
              {
                completed_timestamp: 1793034000000,
                keystone_level: 10,
                dungeon: { id: 1, name: 'Dungeon' },
              },
            ],
          },
        });
      }
      return url.pathname.endsWith('/example')
        ? Response.json(profile)
        : new Response('', { status: 404 });
    },
  },
);
(async () => {
  for (mode of ['success', 'timeout', 'unavailable', 'malformed']) {
    const result = await fetchCharacterProfile({
      region: 'us',
      realm: 'realm',
      characterName: 'example',
    });
    assert.equal(result.ok, true, mode);
    if (mode === 'success') assert.equal(result.profile.weekly_mythic_runs[0].level, 10);
    else assert.equal(result.profile.weekly_mythic_runs, undefined);
    assert.ok(!JSON.stringify(result).includes('SYNTHETIC_TEST_TOKEN'));
  }
  assert.equal(calls.filter((url) => url.includes('/mythic-keystone-profile')).length, 4);
  console.log(
    '4 weekly provider outcomes passed; optional failures preserve the profile. No live requests.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
