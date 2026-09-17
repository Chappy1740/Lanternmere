import { z } from 'zod';
import { isBlizzardPortrait } from './portrait';

const optionalName = z.object({ name: z.string().optional() }).optional().catch(undefined);
export const displayProfileSchema = z.object({
  name: z.string().optional().catch(undefined),
  realm: optionalName,
  active_spec: optionalName,
  race: optionalName,
  equipped_item_level: z.number().int().nonnegative().optional().catch(undefined),
  average_item_level: z.number().int().nonnegative().optional().catch(undefined),
  portrait_url: z.string().refine(isBlizzardPortrait).optional().catch(undefined),
});

// A product reminder, not a claim that Blizzard's data has changed.
export const REFRESH_SUGGESTION_MS = 24 * 60 * 60 * 1000;

export function characterFreshness(refreshedAt?: string, failedAt?: string, now = Date.now()) {
  const refreshed = refreshedAt ? Date.parse(refreshedAt) : NaN;
  const failed = failedAt ? Date.parse(failedAt) : NaN;
  const valid = Number.isFinite(refreshed);
  const age = valid ? Math.max(0, now - refreshed) : 0;
  const hours = Math.floor(age / 3_600_000);
  const minutes = Math.floor(age / 60_000);
  const days = Math.floor(hours / 24);
  const label = !valid
    ? 'Import time unavailable'
    : age < 60_000
      ? 'Imported just now'
      : hours < 1
        ? `Imported ${minutes} minute${minutes === 1 ? '' : 's'} ago`
        : hours < 24
          ? `Imported ${hours} hour${hours === 1 ? '' : 's'} ago`
          : `Imported ${days} day${days === 1 ? '' : 's'} ago`;
  return {
    label,
    refreshSuggested: valid && age >= REFRESH_SUGGESTION_MS,
    lastRefreshFailed: Number.isFinite(failed) && (!valid || failed > refreshed),
  };
}
