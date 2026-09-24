import 'server-only';

export type ResetRegion = 'us' | 'eu';

const resetDetails: Record<ResetRegion, { label: string; weekday: number }> = {
  us: { label: 'North America · Tuesday, 8:00 AM Pacific', weekday: 2 },
  eu: { label: 'Europe · Wednesday, 8:00 AM Central European', weekday: 3 },
};

export function weeklyResetForRegion(region: string | null | undefined, now = new Date()) {
  const detail = region === 'us' || region === 'eu' ? resetDetails[region] : null;
  if (!detail) return null;

  const currentWeekday = now.getUTCDay();
  const daysUntil = (detail.weekday - currentWeekday + 7) % 7;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil));
  if (daysUntil === 0) next.setUTCDate(next.getUTCDate() + 7);

  return {
    ...detail,
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(next),
  };
}

export function weekEndDate(now = new Date()) {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 7);
  return end.toISOString().slice(0, 10);
}
