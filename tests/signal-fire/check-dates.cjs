/* eslint-disable @typescript-eslint/no-require-imports, no-console -- UTC display compatibility regression. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const dates = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/signal-fire-date.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: dates },
);
for (const value of [
  '2026-10-11T23:20:00Z',
  '2026-10-13T00:15:00+09:00',
  '2026-03-08T07:30:00Z',
  'invalid',
]) {
  assert.equal(
    dates.formatSignalFireDate(value),
    new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC' }),
  );
  assert.equal(
    dates.formatSignalFireDateTime(value),
    new Date(value).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }),
  );
}
console.log(
  'Reused Signal Fire formatters preserve UTC dates, times, offset handling, and invalid-date display.',
);
