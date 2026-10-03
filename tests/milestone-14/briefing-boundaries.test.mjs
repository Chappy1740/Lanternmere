import assert from 'node:assert/strict';
import { modelFacts } from '../../src/lib/lanternkeeper/model-context.ts';
import { findLanternkeeperDestination } from '../../src/lib/lanternkeeper/navigation.ts';

const facts = [
  {
    id: 'next-raid',
    text: 'Secret raid title and member name',
    source: 'Lanternmere record',
    href: '/guild-hall',
  },
  {
    id: 'applications',
    text: '2 active applications',
    source: 'Lanternmere record',
    href: '/muster',
  },
  {
    id: 'new-sensitive-fact',
    text: 'Applicant answer',
    source: 'Lanternmere record',
    href: '/muster',
  },
];
assert.deepEqual(modelFacts(facts), [
  { id: 'applications', text: '2 active applications', source: 'Lanternmere record' },
]);
assert.equal(
  findLanternkeeperDestination('Where are the boss kills?', 'guild-id')?.href,
  '/chronicle-lens?guild=guild-id',
);
assert.equal(
  findLanternkeeperDestination('Find a verified guide', 'guild-id')?.href,
  '/supply-chest',
);
assert.equal(findLanternkeeperDestination('https://evil.example/', 'guild-id'), null);
