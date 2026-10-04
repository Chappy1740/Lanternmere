import type { BriefingFact } from './briefing';

// AI context is rebuilt from numbers and a fixed freshness label. Page copy,
// names, titles, notes, and links are never forwarded, even for allowed IDs.
function aggregateText(fact: BriefingFact): string | null {
  const values = fact.modelValues;
  const lengths: Record<string, number> = {
    'weekly-raids': 1,
    'raid-confirmations': 2,
    availability: 2,
    readiness: 1,
    roster: 1,
    applications: 1,
    recruitment: 1,
    'recent-changes': 4,
    'recent-loot': 1,
  };
  if (
    !values ||
    values.length !== lengths[fact.id] ||
    !values.every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000)
  )
    return null;
  switch (fact.id) {
    case 'weekly-raids':
      return `${values[0]} raid operations in the next seven UTC dates.`;
    case 'raid-confirmations':
      return `${values[0]} confirmed attendance records and ${values[1]} separate roster planning entries.`;
    case 'availability':
      return `${values[0]} unavailable and ${values[1]} tentative player-entered availability entries in the next seven UTC dates, capped at 200 checked rows.`;
    case 'readiness':
      return `${values[0]} explicitly Guild-shared character readiness records.`;
    case 'roster':
      return fact.modelFreshness === 'fresh' || fact.modelFreshness === 'stale'
        ? `${values[0]} official roster entries; snapshot is ${fact.modelFreshness} by the 24-hour display rule.`
        : null;
    case 'applications':
      return `${values[0]} active applications or trials in up to 200 checked rows; human review is required.`;
    case 'recruitment':
      return `${values[0]} active recruitment needs in up to 200 checked rows.`;
    case 'recent-changes':
      return `${values[0]} raid, ${values[1]} loot, ${values[2]} recruitment, and ${values[3]} other Guild audit events in up to 50 checked rows.`;
    case 'recent-loot':
      return `${values[0]} recorded loot awards in up to 200 checked rows; awards are human decisions.`;
    default:
      return null;
  }
}

export function modelFacts(facts: BriefingFact[]) {
  return facts.flatMap((fact) => {
    const text = aggregateText(fact);
    if (!text) return [];
    const source =
      fact.id === 'availability'
        ? 'Player-entered information'
        : fact.id === 'roster'
          ? 'External snapshot'
          : 'Lanternmere record';
    return [{ id: fact.id, text, source }];
  });
}
