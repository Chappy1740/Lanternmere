/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Rendered real component with synthetic rows. */
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load.cjs');
const { GuildWeeklyProgressBoard } = load('src/components/guild-weekly-progress-board.tsx');
const unknown = {
  id: 'example',
  member: 'Example member',
  character: null,
  realm: null,
  className: null,
  role: null,
  bench: false,
  itemLevel: null,
  completed: null,
  remaining: null,
  bosses: null,
  observedBosses: [],
  observedRuns: [],
  vault: { raid: null, dungeon: null, world: null },
  reportedAt: null,
  snapshotAt: null,
  status: 'unknown',
  equipment: [],
};
const html = renderToStaticMarkup(
  React.createElement(GuildWeeklyProgressBoard, { rows: [unknown], requirement: null }),
);
for (const phrase of [
  'Find a raider',
  'Work remaining',
  'Unknown or update needed',
  'Sort by',
  'View gear and observed activity',
  'Total completion is unknown',
  'Lockout availability is unknown',
])
  assert.ok(html.includes(phrase), phrase);
assert.ok(!html.includes('href="/travelers/'), 'No unauthorized owner-only detail link');
assert.ok(
  html.includes('<caption') && html.includes('scope="col"') && html.includes('scope="row"'),
);
assert.ok(!html.includes('0 / 8'), 'Missing values cannot become zero');
const escaped = renderToStaticMarkup(
  React.createElement(GuildWeeklyProgressBoard, {
    rows: [{ ...unknown, member: '<script>alert(1)</script>' }],
    requirement: null,
  }),
);
assert.ok(!escaped.includes('<script>'));
assert.ok(escaped.includes('&lt;script&gt;'));
console.log('Weekly board render, mobile/desktop structure, source labels and escaping passed.');
