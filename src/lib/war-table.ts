import 'server-only';

export type ResetRegion = 'us' | 'eu';

const resetDetails: Record<ResetRegion, { label: string; weekday: number; timeZone: string }> = {
  us: {
    label: 'North America · Tuesday, 8:00 AM Pacific',
    weekday: 2,
    timeZone: 'America/Los_Angeles',
  },
  eu: {
    label: 'Europe · Wednesday, 8:00 AM Central European',
    weekday: 3,
    timeZone: 'Europe/Paris',
  },
};

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const number = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: number('year'),
    month: number('month'),
    day: number('day'),
    hour: number('hour'),
    minute: number('minute'),
  };
}

function resetInstant(date: Date, timeZone: string) {
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 8);
  let instant = target;
  for (let attempt = 0; attempt < 2; attempt++) {
    const local = zoneParts(new Date(instant), timeZone);
    const displayedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
    );
    instant += target - displayedAsUtc;
  }
  return new Date(instant);
}

export function weeklyResetForRegion(region: string | null | undefined, now = new Date()) {
  const detail = region === 'us' || region === 'eu' ? resetDetails[region] : null;
  if (!detail) return null;

  const local = zoneParts(now, detail.timeZone);
  const localDay = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysUntil = (detail.weekday - localDay.getUTCDay() + 7) % 7;
  localDay.setUTCDate(localDay.getUTCDate() + daysUntil);
  let next = resetInstant(localDay, detail.timeZone);
  if (next <= now) {
    localDay.setUTCDate(localDay.getUTCDate() + 7);
    next = resetInstant(localDay, detail.timeZone);
  }

  return {
    ...detail,
    isoDate: localDay.toISOString().slice(0, 10),
    date: new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: detail.timeZone }).format(
      next,
    ),
    at: next.toISOString(),
  };
}

export function weekEndDate(now = new Date()) {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 7);
  return end.toISOString().slice(0, 10);
}
