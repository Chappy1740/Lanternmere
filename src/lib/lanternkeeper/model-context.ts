import type { BriefingFact } from './briefing';

// Explicit allowlist: adding a new fact to the UI cannot silently send it to a provider.
const aggregateFactIds = new Set([
  'weekly-raids',
  'raid-confirmations',
  'availability',
  'readiness',
  'roster',
  'applications',
  'recruitment',
  'recent-changes',
  'recent-loot',
]);

export function modelFacts(facts: BriefingFact[]) {
  return facts
    .filter((fact) => aggregateFactIds.has(fact.id))
    .map(({ id, text, source }) => ({ id, text, source }));
}
