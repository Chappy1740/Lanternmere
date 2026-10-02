/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked action boundaries. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const lodgeId = '11111111-1111-4111-8111-111111111111';
const achievementId = '22222222-2222-4222-8222-222222222222';
const creatorId = '33333333-3333-4333-8333-333333333333';
const adminId = '44444444-4444-4444-8444-444444444444';
const characterId = '55555555-5555-4555-8555-555555555555';
const otherCharacterId = '66666666-6666-4666-8666-666666666666';
let actorId;
let role;
let existing;
let write;
let operation;
let payload;

const client = {
  auth: { getUser: async () => ({ data: { user: { id: actorId } }, error: null }) },
  from(table) {
    const query = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      update(value) {
        operation = 'update';
        payload = value;
        return this;
      },
      delete() {
        operation = 'delete';
        return this;
      },
      maybeSingle: async () => {
        if (table === 'lodge_members') return { data: role ? { role } : null, error: null };
        if (table === 'characters') return { data: { id: otherCharacterId }, error: null };
        return operation ? write : { data: existing, error: null };
      },
    };
    return query;
  },
};
const actionExports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/app/(app)/(lodge)/hall-of-legends/actions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: actionExports,
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

function editForm(credit = characterId) {
  const data = new FormData();
  data.set('achievementId', achievementId);
  data.set('lodgeId', lodgeId);
  data.set('title', 'Corrected milestone');
  data.set('description', 'A careful correction.');
  data.set('achievedAt', '');
  data.set('characterId', credit);
  return data;
}
function deleteForm() {
  const data = new FormData();
  data.set('achievementId', achievementId);
  return data;
}
async function check(label, run) {
  actorId = adminId;
  role = 'caretaker';
  existing = {
    id: achievementId,
    lodge_id: lodgeId,
    created_by: creatorId,
    character_id: characterId,
    source: 'manual',
  };
  write = { data: { id: achievementId }, error: null };
  operation = '';
  payload = null;
  await run();
  console.log(`PASS: ${label}`);
}

(async () => {
  await check('caretaker editing text keeps the creator’s character credit', async () => {
    const result = await actionExports.updateAchievement({}, editForm());
    assert.equal(result.success, 'Achievement updated.');
    assert.equal(payload.character_id, characterId);
  });
  await check('caretaker cannot replace another creator’s credit', async () => {
    const result = await actionExports.updateAchievement({}, editForm(otherCharacterId));
    assert.match(result.error, /only credit/);
    assert.equal(operation, '');
  });
  await check('former member cannot edit despite being the creator', async () => {
    actorId = creatorId;
    role = null;
    const result = await actionExports.updateAchievement({}, editForm());
    assert.match(result.error, /do not have permission/);
    assert.equal(operation, '');
  });
  await check('Blizzard records cannot be edited in the member action', async () => {
    existing.source = 'blizzard';
    const result = await actionExports.updateAchievement({}, editForm());
    assert.match(result.error, /do not have permission/);
  });
  await check('zero-row update never reports success', async () => {
    write = { data: null, error: null };
    const result = await actionExports.updateAchievement({}, editForm());
    assert.match(result.error, /could not be updated/);
  });
  await check('Blizzard records cannot be deleted in the member action', async () => {
    existing.source = 'blizzard';
    const result = await actionExports.deleteAchievement({}, deleteForm());
    assert.match(result.error, /do not have permission/);
    assert.equal(operation, '');
  });
  await check('zero-row delete never reports success', async () => {
    write = { data: null, error: null };
    const result = await actionExports.deleteAchievement({}, deleteForm());
    assert.match(result.error, /could not be removed/);
  });
  console.log('7 achievement action checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
