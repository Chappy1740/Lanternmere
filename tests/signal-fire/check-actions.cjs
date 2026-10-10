/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused server-action authorization check. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const owner = '11111111-1111-4111-8111-111111111111';
const sender = '22222222-2222-4222-8222-222222222222';
const stranger = '33333333-3333-4333-8333-333333333333';
const reportId = '44444444-4444-4444-8444-444444444444';
let actor = sender;
let report = { id: reportId, status: 'new', sender_id: sender };
const writes = [];
let updateResult;

function query(table) {
  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      if (table !== 'app_feedback_reports') return { data: null, error: null };
      return { data: actor === stranger ? null : report, error: null };
    },
    async single() {
      return { data: { id: reportId }, error: null };
    },
    insert(row) {
      writes.push({ table, operation: 'insert', row });
      return table === 'app_feedback_reports'
        ? { select: () => ({ single: async () => ({ data: { id: reportId }, error: null }) }) }
        : Promise.resolve({ error: null });
    },
    update(row) {
      writes.push({ table, operation: 'update', row });
      report = { ...report, ...row };
      return {
        eq: () => ({
          select: (columns) => {
            assert.equal(columns, 'id,status');
            return { maybeSingle: async () => updateResult ?? { data: report, error: null } };
          },
        }),
      };
    },
  };
}

const actionExports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/app/(app)/signal-fire/actions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: actionExports,
    require(name) {
      const modules = {
        'next/cache': { revalidatePath() {} },
        'next/navigation': {
          redirect() {
            throw new Error('redirect');
          },
        },
        zod: require('zod'),
        '@/lib/hearth/context': {
          getViewer: async () => ({ user: { id: actor }, supabase: { from: query } }),
        },
        '@/lib/env.server': { serverEnv: { APP_OWNER_PROFILE_ID: owner } },
        '@/lib/supabase/admin': { createAdminClient: () => ({ from: query }) },
      };
      assert.ok(name in modules, name);
      return modules[name];
    },
  },
);

const state = { error: null };
const reportForm = new FormData();
reportForm.set('category', 'problem');
reportForm.set('title', 'Broken link');
reportForm.set('body', 'The navigation link goes to an error screen.');
reportForm.set('pageContext', 'Hearth');
const replyForm = new FormData();
replyForm.set('reportId', reportId);
replyForm.set('body', 'Thanks for letting us know.');
const statusForm = new FormData();
statusForm.set('reportId', reportId);
statusForm.set('status', 'reviewing');

(async () => {
  reportForm.set('body', 'Too short');
  assert.ok((await actionExports.submitFeedback(state, reportForm)).error);
  assert.equal(writes.length, 0);
  reportForm.set('body', 'The navigation link goes to an error screen.');
  await assert.rejects(() => actionExports.submitFeedback(state, reportForm), /redirect/);
  assert.deepEqual(writes[0].row.sender_id, sender);

  actor = stranger;
  assert.ok((await actionExports.replyToFeedback(state, replyForm)).error);
  assert.ok((await actionExports.setFeedbackStatus(state, statusForm)).error);
  assert.equal(writes.length, 1);

  actor = sender;
  assert.equal((await actionExports.replyToFeedback(state, replyForm)).error, null);
  assert.equal(writes[1].row.author_id, sender);
  assert.ok((await actionExports.setFeedbackStatus(state, statusForm)).error);
  assert.equal(writes.length, 2);

  actor = owner;
  assert.equal((await actionExports.replyToFeedback(state, replyForm)).error, null);
  assert.equal(writes[2].row.author_id, owner);
  const saved = await actionExports.setFeedbackStatus(state, statusForm);
  assert.equal(saved.error, null);
  assert.equal(saved.savedStatus, 'reviewing');
  assert.equal((await query('app_feedback_reports').maybeSingle()).data.status, 'reviewing');
  assert.equal(writes[3].row.status, 'reviewing');

  report = { ...report, status: 'closed' };
  assert.match((await actionExports.replyToFeedback(state, replyForm)).error, /closed/);
  assert.equal(writes.length, 4);
  for (const status of ['planned', 'closed', 'new']) {
    statusForm.set('status', status);
    assert.equal((await actionExports.setFeedbackStatus(state, statusForm)).savedStatus, status);
    assert.equal((await query('app_feedback_reports').maybeSingle()).data.status, status);
  }
  updateResult = { data: { id: reportId, status: 'new' }, error: null };
  statusForm.set('status', 'reviewing');
  assert.ok((await actionExports.setFeedbackStatus(state, statusForm)).error);
  updateResult = { data: null, error: null };
  assert.ok((await actionExports.setFeedbackStatus(state, statusForm)).error);
  console.log('Signal Fire action authorization checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
