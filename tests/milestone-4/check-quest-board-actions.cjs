/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused mocked action regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const lodgeId = '11111111-1111-4111-8111-111111111111';
const eventId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
let actorId = userId;
let event = { id: eventId, lodge_id: lodgeId, created_by: userId };
let write = { data: { id: eventId }, error: null };
let mutation = '';
let adminRole = null;
const paths = [];

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
      update() {
        mutation = 'update';
        return this;
      },
      delete() {
        mutation = 'delete';
        return this;
      },
      maybeSingle: async () => {
        if (table === 'lodge_members')
          return { data: adminRole ? { role: adminRole } : null, error: null };
        return mutation ? write : { data: event, error: null };
      },
    };
    return query;
  },
};

const actionExports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/app/(app)/(lodge)/quest-board/actions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: actionExports,
    require(name) {
      const dependencies = {
        'next/cache': { revalidatePath: (path) => paths.push(path) },
        'next/navigation': {
          redirect: (path) => {
            throw new Error(`REDIRECT:${path}`);
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

function form(includeDetails = false) {
  const data = new FormData();
  data.set('eventId', eventId);
  if (includeDetails) {
    data.set('lodgeId', lodgeId);
    data.set('title', 'Updated raid');
    data.set('activityType', 'Raid');
    data.set('eventDate', '2026-10-03');
    data.set('eventTime', '20:00');
    data.set('difficulty', 'Heroic');
    data.set('notes', 'Bring potions');
  }
  return data;
}

async function check(label, run) {
  actorId = userId;
  event = { id: eventId, lodge_id: lodgeId, created_by: userId };
  write = { data: { id: eventId }, error: null };
  mutation = '';
  adminRole = null;
  paths.length = 0;
  await run();
  console.log(`PASS: ${label}`);
}

(async () => {
  await check('update rejects an RLS-filtered zero-row write', async () => {
    write = { data: null, error: null };
    const result = await actionExports.updateEvent({ error: null, success: null }, form(true));
    assert.match(result.error, /could not be updated/);
    assert.equal(paths.length, 0);
  });
  await check('update reports success only after a returned row', async () => {
    const result = await actionExports.updateEvent({ error: null, success: null }, form(true));
    assert.equal(result.success, 'Event details updated.');
    assert.ok(paths.includes('/hearth'));
  });
  await check('delete rejects a Guild-linked foreign-key error', async () => {
    write = { data: null, error: { code: '23503' } };
    const result = await actionExports.deleteEvent({ error: null, success: null }, form());
    assert.match(result.error, /Guild raid records/);
    assert.equal(paths.length, 0);
  });
  await check('delete rejects an RLS-filtered zero-row write', async () => {
    write = { data: null, error: null };
    const result = await actionExports.deleteEvent({ error: null, success: null }, form());
    assert.match(result.error, /no longer available/);
    assert.equal(paths.length, 0);
  });
  await check('non-admin non-creator cannot delete', async () => {
    actorId = '44444444-4444-4444-8444-444444444444';
    const result = await actionExports.deleteEvent({ error: null, success: null }, form());
    assert.match(result.error, /do not have permission/);
    assert.equal(mutation, '');
  });
  await check('Lodge caretaker may remove an unlinked event', async () => {
    actorId = '44444444-4444-4444-8444-444444444444';
    adminRole = 'caretaker';
    await assert.rejects(
      actionExports.deleteEvent({ error: null, success: null }, form()),
      /REDIRECT:\/quest-board\?lodge=/,
    );
  });
  await check('event edits reject a mismatched Lodge field', async () => {
    const data = form(true);
    data.set('lodgeId', '55555555-5555-4555-8555-555555555555');
    const result = await actionExports.updateEvent({ error: null, success: null }, data);
    assert.match(result.error, /do not have permission/);
    assert.equal(mutation, '');
  });
  await check('successful delete redirects to the selected Lodge board', async () => {
    await assert.rejects(
      actionExports.deleteEvent({ error: null, success: null }, form()),
      /REDIRECT:\/quest-board\?lodge=11111111-1111-4111-8111-111111111111/,
    );
    assert.ok(paths.includes('/quest-board'));
  });
  console.log('8 Quest Board action checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
