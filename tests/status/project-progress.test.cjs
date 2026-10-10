/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Local tracker regression, no network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const tracker = require('../../docs/project-tracker.json');

const exportsObject = {};
const source = fs.readFileSync('src/lib/project-status.ts', 'utf8');
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  {
    exports: exportsObject,
    require: (id) => (id.endsWith('project-tracker.json') ? { default: tracker } : require(id)),
  },
);

const { projectProgress, trackerSchema } = exportsObject;
const current = trackerSchema.parse(tracker);
const currentProgress = projectProgress(current);
assert.equal(currentProgress.implemented, 14);
assert.equal(currentProgress.total, 16);
assert.equal(currentProgress.acceptanceTotal, 18);
assert.equal(currentProgress.verified, 3);
assert.ok(currentProgress.percent < 100);
assert.equal(
  currentProgress.percent,
  Math.floor((currentProgress.completed / currentProgress.required) * 100),
);
assert.ok(currentProgress.completed < currentProgress.required);
assert.ok(currentProgress.openRequests.some((request) => request.id === 'CR-027'));
assert.ok(currentProgress.openRequests.some((request) => request.id === 'CR-029'));
assert.ok(currentProgress.openWork.some((item) => item.id === 'M1-password-recovery-link'));
assert.ok(currentProgress.openWork.some((item) => item.id === 'M15-03'));
assert.ok(!currentProgress.openWork.some((item) => item.id === 'M15-01'));

const ready = structuredClone(current);
for (const item of ready.acceptance) item.status = 'verified';
for (const request of ready.requests) {
  if (request.status === 'accepted' || request.status === 'in_progress') request.status = 'done';
}
for (const milestone of ready.milestones) {
  milestone.status = 'implemented';
  for (const item of milestone.work) item.status = 'done';
}
assert.equal(projectProgress(ready).percent, 100);

ready.acceptance[0].status = 'open';
assert.ok(projectProgress(ready).percent < 100);
ready.acceptance[0].status = 'verified';
ready.requests.find((request) => request.id === 'CR-019').status = 'accepted';
assert.ok(projectProgress(ready).percent < 100);
console.log(
  `Project completion tracks live checks and accepted repairs: ${currentProgress.completed}/${currentProgress.required} (${currentProgress.percent}%).`,
);
