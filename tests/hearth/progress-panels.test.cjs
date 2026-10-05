/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Local rendered-data regression, no credentials or network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/components/hearth-progress-panels.tsx', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText,
  { exports: exportsObject, require },
);
const render = (props) =>
  renderToStaticMarkup(React.createElement(exportsObject.HearthProgressPanels, props));
const history = [
  { mythic_plus_score: 500, season_label: 'Current season', refreshed_at: '2026-10-05T12:00:00Z' },
  { mythic_plus_score: 0, season_label: 'Current season', refreshed_at: '2026-10-04T12:00:00Z' },
  {
    mythic_plus_score: 2500,
    season_label: 'Previous season',
    refreshed_at: '2026-09-01T12:00:00Z',
  },
];
const encounters = [
  {
    raid: 'Current raid',
    difficulty: 'Heroic',
    boss: 'Sample boss',
    kills: 2,
    last_kill_at: '2026-10-04T12:00:00Z',
  },
  { raid: 'Other raid', difficulty: 'Normal', boss: 'Other boss', kills: 6, last_kill_at: null },
];
const html = render({ history, encounters, unavailable: false });
assert.match(html, /View exact scores/);
assert.match(html, /<td>0<\/td>/);
assert.match(html, /<td>500<\/td>/);
assert.doesNotMatch(html, /2500/);
assert.match(html, /Sample boss/);
assert.doesNotMatch(html, /Other boss/);
assert.match(html, /not weekly dungeon counts/);
assert.match(html, /<desc/);
assert.match(html, /scope="col"/);
assert.match(render({ history: [], unavailable: false }), /start a trend/);
assert.match(render({ history, encounters, unavailable: true }), /History could not be loaded/);
assert.doesNotMatch(render({ history, unavailable: true }), /<svg/);
console.log(
  'Hearth rendered-data checks passed: season separation, zero scores, raid scope, accessible alternatives, empty and unavailable states.',
);
