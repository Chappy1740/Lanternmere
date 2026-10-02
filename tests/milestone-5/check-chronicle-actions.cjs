/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked action boundaries. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const lodgeId = '11111111-1111-4111-8111-111111111111';
const chronicleId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const mediaId = '44444444-4444-4444-8444-444444444444';
let member;
let entry;
let media;
let write;
let operation;
let storageRemovals;
const client = {
  auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
  from(table) {
    const query = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      update() {
        operation = 'update';
        return this;
      },
      delete() {
        operation = 'delete';
        return this;
      },
      maybeSingle: async () => {
        if (table === 'lodge_members')
          return { data: member ? { lodge_id: lodgeId } : null, error: null };
        return operation
          ? write
          : { data: table === 'chronicle_media' ? media : entry, error: null };
      },
      then(resolve, reject) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    return query;
  },
  storage: {
    from() {
      return {
        remove: async (paths) => {
          storageRemovals.push(...paths);
          return { error: null };
        },
      };
    },
  },
};
const actionExports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/app/(app)/(lodge)/chronicles/actions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: actionExports,
    File,
    require(name) {
      const dependencies = {
        'next/cache': { revalidatePath() {} },
        'next/navigation': {
          redirect() {
            throw new Error('redirect');
          },
        },
        zod: require('zod'),
        '@/lib/supabase/server': { createClient: async () => client },
      };
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  },
);

function editForm() {
  const data = new FormData();
  data.set('chronicleId', chronicleId);
  data.set('lodgeId', lodgeId);
  data.set('title', 'Updated story');
  data.set('body', 'The Lodge gathered again.');
  data.set('caption', '');
  return data;
}
function deleteForm() {
  const data = new FormData();
  data.set('chronicleId', chronicleId);
  return data;
}
function deleteMediaForm() {
  const data = new FormData();
  data.set('mediaId', mediaId);
  return data;
}
async function check(label, run) {
  member = true;
  entry = { id: chronicleId, lodge_id: lodgeId, author_id: userId };
  media = {
    id: mediaId,
    chronicle_id: chronicleId,
    lodge_id: lodgeId,
    uploaded_by: userId,
    storage_path: `${lodgeId}/${chronicleId}/audit.webp`,
  };
  write = { data: { id: chronicleId }, error: null };
  operation = '';
  storageRemovals = [];
  await run();
  console.log(`PASS: ${label}`);
}

(async () => {
  await check('author can update a Chronicle', async () => {
    const result = await actionExports.updateChronicle({}, editForm());
    assert.equal(result.success, 'Chronicle updated.');
  });
  await check('former member cannot update despite authorship', async () => {
    member = false;
    const result = await actionExports.updateChronicle({}, editForm());
    assert.match(result.error, /do not have permission/);
    assert.equal(operation, '');
  });
  await check('zero-row Chronicle update never reports success', async () => {
    write = { data: null, error: null };
    const result = await actionExports.updateChronicle({}, editForm());
    assert.match(result.error, /could not be updated/);
  });
  await check('former member cannot remove a Chronicle', async () => {
    member = false;
    const result = await actionExports.deleteChronicle({}, deleteForm());
    assert.match(result.error, /do not have permission/);
    assert.equal(operation, '');
  });
  await check('zero-row Chronicle delete never reports success', async () => {
    write = { data: null, error: null };
    const result = await actionExports.deleteChronicle({}, deleteForm());
    assert.match(result.error, /could not be removed/);
  });
  await check('former member cannot remove Chronicle media', async () => {
    member = false;
    const result = await actionExports.deleteChronicleMedia({}, deleteMediaForm());
    assert.match(result.error, /do not have permission/);
    assert.deepEqual(storageRemovals, []);
  });
  await check('current uploader can remove Chronicle media', async () => {
    const result = await actionExports.deleteChronicleMedia({}, deleteMediaForm());
    assert.equal(result.success, 'Chronicle image removed.');
    assert.deepEqual(storageRemovals, [media.storage_path]);
  });
  console.log('7 Chronicle action checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
