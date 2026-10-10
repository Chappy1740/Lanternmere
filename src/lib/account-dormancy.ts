const inactivityDays = 30;
const dayMs = 24 * 60 * 60 * 1000;

export type AccountActivityState = 'active' | 'dormant' | 'unknown';

export function accountActivityState(lastSeenAt: string | null, now: Date): AccountActivityState {
  if (!lastSeenAt) return 'unknown';
  const lastSeen = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeen)) return 'unknown';
  return now.getTime() - lastSeen >= inactivityDays * dayMs ? 'dormant' : 'active';
}
