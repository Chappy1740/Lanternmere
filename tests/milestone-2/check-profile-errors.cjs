/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Standalone CommonJS test runner with console results. */
// Run: node check-profile-errors.cjs [repository path]
// Loads real TypeScript with the repository's compiler; all I/O dependencies are mocked.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const repo = path.resolve(process.argv[2] || path.join(__dirname, '../..'));
const localRequire = createRequire(path.join(repo, 'package.json'));
const ts = localRequire('typescript');
let tokenError = false,
  calls = 0,
  tokenCalls = 0,
  responder;
function load(file, dependencies) {
  const source = fs.readFileSync(path.join(repo, file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    code,
    {
      exports,
      URL,
      AbortSignal,
      Date,
      require(name) {
        if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name);
        return dependencies[name];
      },
      fetch: async (...args) => {
        calls++;
        return responder(...args);
      },
    },
    { filename: file },
  );
  return exports;
}
const input = load('src/lib/wow/character-input.ts', { zod: localRequire('zod') });
const portrait = load('src/lib/wow/portrait.ts', {});
const { fetchCharacterProfile } = load('src/lib/wow/character-profile.ts', {
  'server-only': {},
  zod: localRequire('zod'),
  './character-input': input,
  './portrait': portrait,
  './blizzard-token': {
    getBlizzardToken: async () => {
      tokenCalls++;
      if (tokenError) throw new Error('SENSITIVE_SENTINEL');
      return 'FAKE_TEST_TOKEN';
    },
  },
});
const valid = { region: 'us', realm: 'Stormrage', characterName: 'Wrenx' };
let passed = 0;
async function failure(label, response, code, messagePattern, given = valid) {
  calls = 0;
  tokenCalls = 0;
  responder = response;
  const result = await fetchCharacterProfile(given);
  assert.equal(result.ok, false, label);
  assert.equal(result.code, code, label);
  assert.match(result.message, messagePattern, label);
  assert.ok(!JSON.stringify(result).includes('SENSITIVE_SENTINEL'), label);
  assert.ok(!JSON.stringify(result).includes('FAKE_TEST_TOKEN'), label);
  assert.equal(calls, code === 'invalid_input' || tokenError ? 0 : 1, label);
  assert.equal(tokenCalls, code === 'invalid_input' ? 0 : 1, label);
  console.log('PASS: ' + label);
  passed++;
}
(async () => {
  for (const [status, code, pattern] of [
    [429, 'throttled', /limiting requests/i],
    [404, 'unavailable', /unavailable.*private/i],
    [401, 'authentication', /denied access/i],
    [403, 'authentication', /denied access/i],
    [500, 'integration', /returned an error/i],
    [503, 'integration', /returned an error/i],
  ])
    await failure(
      'HTTP ' + status,
      () => new Response('SENSITIVE_SENTINEL', { status }),
      code,
      pattern,
    );
  await failure(
    'network failure',
    () => {
      throw new Error('SENSITIVE_SENTINEL');
    },
    'integration',
    /could not be reached/i,
  );
  await failure(
    'timeout rejection',
    () => {
      throw new DOMException('SENSITIVE_SENTINEL', 'TimeoutError');
    },
    'integration',
    /could not be reached/i,
  );
  await failure(
    'malformed JSON',
    () => new Response('not-json'),
    'integration',
    /unexpected character profile/i,
  );
  await failure(
    'invalid profile shape',
    () => Response.json({ access_token: 'SENSITIVE_SENTINEL' }),
    'integration',
    /unexpected character profile/i,
  );
  tokenError = true;
  await failure(
    'token failure prevents profile fetch',
    () => {
      throw new Error('must not fetch');
    },
    'authentication',
    /Blizzard authentication/i,
  );
  tokenError = false;
  await failure(
    'invalid input performs no I/O',
    () => {
      throw new Error('must not fetch');
    },
    'invalid_input',
    /only letters/i,
    { ...valid, characterName: 'Wrenx123' },
  );
  responder = (url, options) => {
    if (url.pathname.endsWith('/character-media')) return new Response('', { status: 404 });
    assert.equal(url.pathname, '/profile/wow/character/stormrage/wrenx');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    return Response.json({
      id: 1,
      name: 'Wrenx',
      level: 90,
      realm: { id: 1, name: 'Stormrage', slug: 'stormrage' },
      character_class: { id: 4, name: 'Rogue' },
      race: { id: 1, name: 'Human' },
      faction: { type: 'ALLIANCE', name: 'Alliance' },
    });
  };
  const result = await fetchCharacterProfile({
    region: ' US ',
    realm: ' STORMRAGE ',
    characterName: ' WRENX ',
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'blizzard');
  assert.equal(result.region, 'us');
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  console.log('PASS: successful recovery, normalization, and timestamp');
  passed++;
  console.log(`${passed} checks passed. No live network or credentials used.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
