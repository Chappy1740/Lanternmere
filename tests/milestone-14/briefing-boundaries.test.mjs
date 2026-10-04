import assert from 'node:assert/strict';
import { modelFacts } from '../../src/lib/lanternkeeper/model-context.ts';
import { findLanternkeeperDestination } from '../../src/lib/lanternkeeper/navigation.ts';
import {
  canReadGuildAudit,
  recentChangesFact,
} from '../../src/lib/lanternkeeper/recent-changes.ts';

const facts = [
  {
    id: 'next-raid',
    text: 'Secret raid title and member name',
    source: 'Lanternmere record',
    href: '/guild-hall',
  },
  {
    id: 'applications',
    text: '2 active applications; secret applicant answer and raid title',
    source: 'Lanternmere record',
    href: '/muster',
    modelValues: [2],
  },
  {
    id: 'new-sensitive-fact',
    text: 'Applicant answer',
    source: 'Lanternmere record',
    href: '/muster',
  },
];
assert.deepEqual(modelFacts(facts), [
  {
    id: 'applications',
    text: '2 active applications or trials in up to 200 checked rows; human review is required.',
    source: 'Lanternmere record',
  },
]);
assert.equal(JSON.stringify(modelFacts(facts)).includes('secret'), false);
assert.deepEqual(modelFacts([{ ...facts[1], modelValues: undefined }]), []);
assert.deepEqual(modelFacts([{ ...facts[1], modelValues: [2, 3] }]), []);
assert.equal(
  findLanternkeeperDestination('Where are the boss kills?', 'guild-id')?.href,
  '/chronicle-lens?guild=guild-id',
);
assert.equal(
  findLanternkeeperDestination('Find a verified guide', 'guild-id')?.href,
  '/supply-chest',
);
assert.equal(findLanternkeeperDestination('https://evil.example/', 'guild-id'), null);
for (const [name, href] of [
  ['Guild Hall', '/guild-hall?guild=guild-id'],
  ['The Muster', '/muster?guild=guild-id'],
  ['Artisan Hall', '/artisan-hall?guild=guild-id'],
  ['War Table', '/war-table'],
  ['Chronicle Lens', '/chronicle-lens?guild=guild-id'],
  ['Supply Chest', '/supply-chest'],
]) {
  assert.equal(findLanternkeeperDestination(name, 'guild-id')?.href, href, name);
}
assert.equal(
  findLanternkeeperDestination('Where is the supply chest?', 'guild-id')?.href,
  '/supply-chest',
);

assert.equal(canReadGuildAudit(['raid_leader']), false);
assert.equal(canReadGuildAudit(['officer']), true);
assert.equal(canReadGuildAudit(['guild_master']), true);
const counts = { raid: 2, loot: 1, recruitment: 0, other: 3 };
const raidLeaderFact = recentChangesFact(false, null, '2026-10-04', true, '/guild-hall');
assert.equal(raidLeaderFact.source, 'Missing data');
assert.deepEqual(modelFacts([raidLeaderFact]), []);
const officerFact = recentChangesFact(true, counts, '2026-10-04', true, '/guild-hall');
assert.equal(officerFact.source, 'Lanternmere record');
assert.equal(
  modelFacts([officerFact])[0].text,
  '2 raid, 1 loot, 0 recruitment, and 3 other Guild audit events in up to 50 checked rows.',
);
