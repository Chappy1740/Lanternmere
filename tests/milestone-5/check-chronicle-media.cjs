/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked Chronicle media regression runner. */
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
      require: (name) => (assert.ok(name in dependencies, name), dependencies[name]),
      Intl,
      Promise,
    },
  );
  return exports;
}

const chronicles = load('src/lib/chronicles.ts', { 'server-only': {}, zod: require('zod') });
const lodgeId = '11111111-1111-4111-8111-111111111111';
const chronicleId = '22222222-2222-4222-8222-222222222222';
const mediaId = '33333333-3333-4333-8333-333333333333';
const authorId = '44444444-4444-4444-8444-444444444444';
let calls = [];
let rows = [];
const client = {
  from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'order', 'limit']) {
      query[method] = (...args) => {
        calls.push([table, method, ...args]);
        return query;
      };
    }
    query.then = (resolve, reject) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    return query;
  },
  storage: {
    from(bucket) {
      assert.equal(bucket, 'chronicle-media');
      return {
        createSignedUrl: async (path, seconds) => {
          assert.equal(seconds, 3600);
          return { data: { signedUrl: `https://example.test/${path}` }, error: null };
        },
      };
    },
  },
};

function media(overrides = {}) {
  return {
    id: mediaId,
    chronicle_id: chronicleId,
    lodge_id: lodgeId,
    uploaded_by: authorId,
    storage_path: `${lodgeId}/${chronicleId}/image.webp`,
    caption: 'The Lodge after the victory.',
    created_at: '2026-09-18T19:30:00.000Z',
    ...overrides,
  };
}

(async () => {
  rows = [media()];
  const result = await chronicles.loadChronicleMedia(client, chronicleId, lodgeId);
  assert.equal(result[0].url, `https://example.test/${media().storage_path}`);
  assert.ok(calls.some((call) => call[1] === 'eq' && call[2] === 'chronicle_id'));
  assert.ok(calls.some((call) => call[1] === 'eq' && call[2] === 'lodge_id'));
  assert.ok(calls.some((call) => call[1] === 'limit' && call[2] === 12));

  calls = [];
  rows = [media({ storage_path: '' })];
  assert.equal(await chronicles.loadChronicleMedia(client, chronicleId, lodgeId), null);

  const migration = fs.readFileSync(
    'supabase/migrations/20260918185955_add_chronicle_media_storage.sql',
    'utf8',
  );
  for (const expected of [
    "'chronicle-media'",
    'chronicle_media_select_member',
    'chronicle_media_objects_select_member',
    'chronicle_media_objects_insert_author_or_admin',
    'chronicle_media_objects_delete_uploader_or_admin',
    'allowed_mime_types',
  ]) {
    assert.match(migration, new RegExp(expected));
  }
  console.log('Chronicle media checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
