import 'server-only';

import { z } from 'zod';

const responseSchema = z.object({
  profile_url: z.string().url().refine((value) => new URL(value).hostname.endsWith('raider.io')),
  mythic_plus_scores_by_season: z
    .array(z.object({ scores: z.object({ all: z.number().nullable().optional() }) }))
    .default([]),
  raid_progression: z.unknown().default({}),
});

export type RaiderIoCharacterInput = {
  region: string;
  realm: string;
  characterName: string;
};

export type RaiderIoResult =
  | { ok: true; score: number | null; raidProgression: unknown; sourceUrl: string }
  | { ok: false; message: string };

export async function fetchRaiderIoProgress(
  input: RaiderIoCharacterInput,
): Promise<RaiderIoResult> {
  const params = new URLSearchParams({
    region: input.region.toLowerCase(),
    realm: input.realm,
    name: input.characterName,
    fields: 'mythic_plus_scores_by_season:current,raid_progression',
  });

  try {
    const response = await fetch(`https://raider.io/api/v1/characters/profile?${params}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 429)
      return { ok: false, message: 'Raider.IO is busy. Please wait and try again later.' };
    if (response.status === 404)
      return { ok: false, message: 'Raider.IO could not find this character.' };
    if (!response.ok)
      return { ok: false, message: 'Raider.IO progress is unavailable right now. Please try again later.' };

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success)
      return { ok: false, message: 'Raider.IO returned an unexpected response. Please try again later.' };

    return {
      ok: true,
      score: parsed.data.mythic_plus_scores_by_season[0]?.scores.all ?? null,
      raidProgression: parsed.data.raid_progression,
      sourceUrl: parsed.data.profile_url,
    };
  } catch {
    return { ok: false, message: 'Raider.IO progress is unavailable right now. Please try again later.' };
  }
}
