import type { BriefingFact } from './briefing';

type ChangeCounts = { raid: number; loot: number; recruitment: number; other: number };

export function canReadGuildAudit(roles: string[]) {
  return roles.some((role) => role === 'guild_master' || role === 'officer');
}

export function recentChangesFact(
  canReadAudit: boolean,
  categories: ChangeCounts | null,
  cutoff: string,
  hasLastRaid: boolean,
  guildLink: string,
): BriefingFact {
  if (!canReadAudit || !categories)
    return {
      id: 'changes-unavailable',
      text: canReadAudit
        ? 'Recent change history could not be loaded. Counts are withheld.'
        : 'Recent change history needs Officer or Guild Master access. Counts are withheld.',
      source: 'Missing data',
      href: guildLink,
    };
  return {
    id: 'recent-changes',
    text: `Since ${hasLastRaid ? `the last recorded raid date (${cutoff})` : `${cutoff} (no earlier raid found)`}: ${categories.raid} raid, ${categories.loot} loot, ${categories.recruitment} recruitment, and ${categories.other} other Guild audit events. This list is capped at 50 and may not include every change.`,
    source: 'Lanternmere record',
    href: guildLink,
    modelValues: [categories.raid, categories.loot, categories.recruitment, categories.other],
  };
}
