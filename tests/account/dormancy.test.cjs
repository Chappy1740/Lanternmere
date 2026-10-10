/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Local date-boundary regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/account-dormancy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: exportsObject },
);

const state = exportsObject.accountActivityState;
const now = new Date('2026-10-10T12:00:00.000Z');
assert.equal(state(null, now), 'unknown');
assert.equal(state('bad timestamp', now), 'unknown');
assert.equal(state('2026-09-10T12:00:00.001Z', now), 'active');
assert.equal(state('2026-09-10T12:00:00.000Z', now), 'dormant');
assert.equal(state('2026-10-10T12:00:00.000Z', now), 'active');
console.log('Thirty-day dormancy boundary and return activity pass.');
