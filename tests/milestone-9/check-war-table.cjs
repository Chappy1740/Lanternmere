/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Focused reset and calendar regression runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTypeScript(relativePath) {
  const filename = path.join(__dirname, '..', '..', relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    js,
    {
      exports,
      require(name) {
        if (name === 'server-only') return {};
        throw new Error(`Unexpected import: ${name}`);
      },
      Date,
      Intl,
      TextEncoder,
    },
    { filename },
  );
  return exports;
}

const { weeklyResetForRegion } = loadTypeScript('src/lib/war-table.ts');
const { warTableCalendarIcs } = loadTypeScript('src/lib/war-table-calendar.ts');

assert.equal(weeklyResetForRegion('kr'), null);
assert.equal(
  weeklyResetForRegion('us', new Date('2026-03-10T14:00:00Z')).at,
  '2026-03-10T15:00:00.000Z',
);
assert.equal(weeklyResetForRegion('us', new Date('2026-03-10T16:00:00Z')).isoDate, '2026-03-17');
assert.equal(
  weeklyResetForRegion('us', new Date('2026-12-01T15:00:00Z')).at,
  '2026-12-01T16:00:00.000Z',
);
assert.equal(
  weeklyResetForRegion('eu', new Date('2026-09-30T05:00:00Z')).at,
  '2026-09-30T06:00:00.000Z',
);

const calendar = warTableCalendarIcs(
  [
    {
      id: 'one',
      title: 'A,b;c\nD',
      date: '2026-10-01',
      time: null,
      description: 'All day',
      url: 'https://example.test/one',
    },
    {
      id: 'two',
      title: 'Raid'.repeat(30),
      date: '2026-10-02',
      time: '18:30:00',
      description: 'Timed',
      url: 'https://example.test/two',
    },
  ],
  'My Guild',
);
assert.match(calendar, /DTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261002/);
assert.match(calendar, /DTSTART:20261002T183000Z\r\nDTEND:20261002T193000Z/);
assert.match(calendar, /SUMMARY:A\\,b\\;c\\nD/);
assert.match(calendar, /\r\n /);
assert.ok(calendar.split('\r\n').every((line) => Buffer.byteLength(line, 'utf8') <= 75));
assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
console.log('Milestone 9 reset and calendar checks passed.');
