/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Mocked recurring-plan regression runner. */
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
      require(name) {
        assert.ok(name in dependencies, name);
        return dependencies[name];
      },
    },
  );
  return exports;
}

const templates = load('src/lib/adventures/event-templates.ts', {
  'server-only': {},
  zod: require('zod'),
});
const lodgeId = '11111111-1111-4111-8111-111111111111';
const templateId = '22222222-2222-4222-8222-222222222222';
const profileId = '33333333-3333-4333-8333-333333333333';
const row = {
  id: templateId,
  lodge_id: lodgeId,
  created_by: profileId,
  title: 'Tuesday raid night',
  activity_type: 'Raid',
  weekday: 2,
  event_time: '19:30:00',
  difficulty: 'Heroic',
  notes: 'Bring flasks.',
  created_at: '2026-09-21T00:00:00+00:00',
};
let calls = [];
let resultRows = [row];

const client = {
  from(table) {
    const query = {};
    for (const method of ['select', 'eq', 'order', 'limit']) {
      query[method] = (...args) => {
        calls.push([table, method, ...args]);
        return query;
      };
    }
    query.maybeSingle = () => Promise.resolve({ data: resultRows[0] ?? null, error: null });
    query.then = (resolve, reject) =>
      Promise.resolve({ data: resultRows, error: null }).then(resolve, reject);
    return query;
  },
};

(async () => {
  const list = await templates.loadEventTemplates(client, lodgeId);
  assert.equal(list[0].id, templateId);
  assert.ok(calls.some((call) => call.join('|') === `event_templates|eq|lodge_id|${lodgeId}`));
  assert.ok(calls.some((call) => call.join('|') === 'event_templates|limit|50'));

  calls = [];
  const detail = await templates.loadEventTemplate(client, templateId, lodgeId);
  assert.equal(detail.id, templateId);
  assert.ok(calls.some((call) => call.join('|') === `event_templates|eq|id|${templateId}`));
  assert.ok(calls.some((call) => call.join('|') === `event_templates|eq|lodge_id|${lodgeId}`));

  assert.equal(templates.templateSchedule(row), 'Every Tuesday at 19:30 UTC');
  assert.equal(templates.templateSchedule({ ...row, event_time: null }), 'Every Tuesday');

  resultRows = [{ ...row, weekday: 8 }];
  assert.equal(await templates.loadEventTemplates(client, lodgeId), null);

  const sql = fs.readFileSync(
    'supabase/migrations/20260921083259_adventure_event_templates.sql',
    'utf8',
  );
  assert.match(sql, /alter table public\.event_templates enable row level security/);
  assert.match(sql, /event_templates_select_member/);
  assert.match(sql, /event_templates_insert_member/);
  assert.match(sql, /event_templates_update_creator_or_admin/);
  assert.match(sql, /event_templates_delete_creator_or_admin/);
  assert.match(sql, /new\.lodge_id is distinct from old\.lodge_id/);
  assert.match(sql, /new\.created_by is distinct from old\.created_by/);
  console.log('5 recurring event-template checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
