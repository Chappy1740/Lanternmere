/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Standalone mocked regression runner. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const zod = require('zod');
const repo = path.resolve(__dirname, '../..');
let responder;
function load(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(path.join(repo, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    URL,
    AbortSignal,
    Date,
    Map,
    fetch: (...args) => responder(...args),
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
const portrait = load('src/lib/wow/portrait.ts', {});
const input = load('src/lib/wow/character-input.ts', { zod });
const display = load('src/lib/wow/character-display.ts', { zod, './portrait': portrait });
const { fetchCharacterProfile } = load('src/lib/wow/character-profile.ts', {
  'server-only': {},
  zod,
  './character-input': input,
  './portrait': portrait,
  './blizzard-token': { getBlizzardToken: async () => 'FAKE_TOKEN' },
});
const profile = {
  id: 7,
  name: 'Wrenx',
  level: 90,
  realm: { id: 1, name: 'Stormrage', slug: 'stormrage' },
  character_class: { id: 4, name: 'Rogue' },
  race: { id: 1, name: 'Human' },
  faction: { type: 'ALLIANCE', name: 'Alliance' },
  equipped_item_level: 150,
  average_item_level: 155,
};
const given = { region: 'us', realm: 'stormrage', characterName: 'wrenx' };
const avatar = 'https://render.worldofwarcraft.com/us/character/stormrage/7/7-avatar.jpg';
const media = { character: { id: 7 }, assets: [{ key: 'avatar', value: avatar }] };
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log('PASS: ' + name);
}
async function fetchWith(mediaResponse, body = profile) {
  responder = (url, options) => {
    assert.equal(url.origin, 'https://us.api.blizzard.com');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    return url.pathname.endsWith('/character-media') ? mediaResponse() : Response.json(body);
  };
  return fetchCharacterProfile(given);
}
(async () => {
  await check('item levels and validated portrait are retained', async () => {
    const result = await fetchWith(() => Response.json(media));
    assert.equal(result.ok, true);
    assert.equal(result.profile.equipped_item_level, 150);
    assert.equal(result.profile.average_item_level, 155);
    assert.equal(result.profile.portrait_url, avatar);
  });
  for (const [label, response] of [
    ['404', () => new Response('', { status: 404 })],
    ['429', () => new Response('', { status: 429 })],
    [
      'timeout',
      () => {
        throw new Error('SENSITIVE');
      },
    ],
    ['invalid JSON', () => new Response('invalid')],
    ['missing assets', () => Response.json({})],
    ['wrong character', () => Response.json({ ...media, character: { id: 8 } })],
    [
      'unsafe URL',
      () =>
        Response.json({ ...media, assets: [{ key: 'avatar', value: 'https://evil.test/a.jpg' }] }),
    ],
  ])
    await check(`media ${label} preserves successful profile`, async () => {
      const result = await fetchWith(response);
      assert.equal(result.ok, true);
      assert.equal(result.profile.name, 'Wrenx');
      assert.equal(result.profile.portrait_url, undefined);
    });
  await check('invalid optional fields do not destroy core profile', async () => {
    const result = await fetchWith(() => Response.json(media), {
      ...profile,
      equipped_item_level: -1,
      average_item_level: 'bad',
    });
    assert.equal(result.ok, true);
    assert.equal(result.profile.equipped_item_level, undefined);
    assert.equal(result.profile.average_item_level, undefined);
  });
  await check('portrait host, scheme, query, path and credentials are restricted', () => {
    assert.equal(portrait.isBlizzardPortrait(avatar), true);
    for (const url of [
      avatar.replace('https:', 'http:'),
      avatar + '?token=secret',
      avatar.replace('render.', 'render.evil.'),
      avatar.replace('/us/character/', '/us/other/'),
      avatar.replace('https://', 'https://user:secret@'),
      avatar.replace('.jpg', '.svg'),
    ]) {
      assert.equal(portrait.isBlizzardPortrait(url), false, url);
    }
  });
  await check('old snapshots and malformed optional display fields remain usable', () => {
    assert.equal(display.displayProfileSchema.parse({ name: 'Wrenx' }).name, 'Wrenx');
    const result = display.displayProfileSchema.parse({
      name: 'Wrenx',
      equipped_item_level: 'bad',
      portrait_url: 'javascript:alert(1)',
    });
    assert.equal(result.name, 'Wrenx');
    assert.equal(result.portrait_url, undefined);
  });
  const now = Date.parse('2026-09-16T12:00:00Z');
  await check('refresh suggestion starts at 24 hours', () => {
    assert.equal(
      display.characterFreshness(new Date(now - 86_399_999).toISOString(), undefined, now)
        .refreshSuggested,
      false,
    );
    assert.equal(
      display.characterFreshness(new Date(now - 86_400_000).toISOString(), undefined, now)
        .refreshSuggested,
      true,
    );
  });
  await check('new success supersedes failure and late older failures stay hidden', () => {
    assert.equal(
      display.characterFreshness('2026-09-16T10:00:00Z', '2026-09-16T11:00:00Z', now)
        .lastRefreshFailed,
      true,
    );
    assert.equal(
      display.characterFreshness('2026-09-16T11:00:00Z', '2026-09-16T10:00:00Z', now)
        .lastRefreshFailed,
      false,
    );
  });
  await check('missing, invalid and future timestamps have safe labels', () => {
    assert.equal(
      display.characterFreshness('bad', undefined, now).label,
      'Import time unavailable',
    );
    assert.equal(display.characterFreshness(undefined, undefined, now).refreshSuggested, false);
    assert.equal(
      display.characterFreshness('2026-09-17T12:00:00Z', undefined, now).label,
      'Imported just now',
    );
  });

  const owner = '11111111-1111-4111-8111-111111111111';
  const saved = '22222222-2222-4222-8222-222222222222';
  let signedIn,
    existing,
    lookupError,
    insertError,
    savedError,
    result,
    writes,
    rpcCalls,
    filters,
    refreshed;
  function reset() {
    signedIn = true;
    existing = true;
    lookupError = false;
    insertError = false;
    savedError = false;
    result = { ok: false, code: 'throttled', message: 'Try again later.' };
    writes = [];
    rpcCalls = [];
    filters = [];
    refreshed = [];
  }
  const query = {
    select() {
      return this;
    },
    eq(key, value) {
      filters.push([key, value]);
      return this;
    },
    async maybeSingle() {
      return { data: existing ? { id: saved } : null, error: lookupError };
    },
  };
  const { addCharacter } = load('src/app/(app)/travelers/new/actions.ts', {
    zod,
    '@/lib/wow/character-input': input,
    'next/cache': { revalidatePath: (p) => refreshed.push(p) },
    'next/navigation': {
      redirect: (p) => {
        throw new Error('REDIRECT:' + p);
      },
    },
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null } }) },
        from: () => query,
      }),
    },
    '@/lib/supabase/admin': {
      createAdminClient: () => ({
        from: (table) => ({
          insert: async (row) => {
            writes.push({ table, row });
            return { error: insertError };
          },
        }),
        rpc: async (name, args) => {
          rpcCalls.push({ name, args });
          return { data: saved, error: savedError };
        },
      }),
    },
    '@/lib/wow/character-profile': { fetchCharacterProfile: async () => result },
  });
  function form(overrides = {}) {
    const f = new FormData();
    for (const [key, value] of Object.entries({
      ...given,
      ...overrides,
      profile_id: 'attacker',
      characterId: 'attacker',
    }))
      f.set(key, value);
    return f;
  }
  await check('unauthenticated and invalid inputs cannot record failures', async () => {
    reset();
    signedIn = false;
    await addCharacter({}, form());
    assert.equal(writes.length, 0);
    reset();
    await addCharacter({}, form({ characterName: '123' }));
    assert.equal(writes.length, 0);
  });
  await check('failure writes use server-resolved owner and character only', async () => {
    reset();
    await addCharacter({}, form());
    assert.ok(filters.some(([key, value]) => key === 'profile_id' && value === owner));
    assert.ok(filters.some(([key, value]) => key === 'games.slug' && value === 'wow'));
    assert.equal(writes[0].row.character_id, saved);
    assert.equal(writes[0].row.failure_code, 'throttled');
    assert.equal(rpcCalls.length, 0);
    assert.ok(refreshed.includes('/hearth'));
  });
  await check('new imports and failed ownership lookups create no failure record', async () => {
    reset();
    existing = false;
    await addCharacter({}, form());
    assert.equal(writes.length, 0);
    reset();
    lookupError = true;
    await addCharacter({}, form());
    assert.equal(writes.length, 0);
  });
  await check('failure persistence errors are safely reported', async () => {
    reset();
    insertError = true;
    assert.match((await addCharacter({}, form())).error, /status could not be saved/);
  });
  await check('successful saves preserve trusted ownership and revalidate Hearth', async () => {
    reset();
    result = { ok: true, profile, region: 'us', fetchedAt: new Date().toISOString() };
    await assert.rejects(addCharacter({}, form()), /REDIRECT:/);
    assert.equal(rpcCalls[0].args.p_profile_id, owner);
    assert.equal(writes.length, 0);
    assert.ok(refreshed.includes('/hearth'));
  });
  await check('save failures record an outcome without replacing snapshots', async () => {
    reset();
    result = { ok: true, profile, region: 'us', fetchedAt: new Date().toISOString() };
    savedError = true;
    await addCharacter({}, form());
    assert.equal(writes[0].row.failure_code, 'save');
  });
  console.log(`${passed} checks passed. No live network or credentials used.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
