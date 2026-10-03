import 'server-only';

import { z } from 'zod';

const bestRunSchema = z.object({
  dungeon: z.string().trim().min(1).max(120),
  mythic_level: z.number().int().min(2).max(40),
  score: z.unknown().optional(),
});

const responseSchema = z.object({
  profile_url: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        (url.hostname === 'raider.io' || url.hostname.endsWith('.raider.io'))
      );
    }),
  mythic_plus_scores_by_season: z
    .array(
      z.object({
        season: z.string().max(80).nullish().catch(null),
        scores: z.object({ all: z.number().nullable().optional() }),
      }),
    )
    .default([]),
  mythic_plus_best_runs: z
    .array(z.unknown())
    .nullish()
    .transform((value) => value ?? []),
  raid_progression: z.unknown().default({}),
});

export type RaiderIoCharacterInput = {
  region: string;
  realm: string;
  characterName: string;
};

export type RaiderIoResult =
  | {
      ok: true;
      score: number | null;
      seasonLabel: string | null;
      bestRuns: { dungeon: string; level: number; score: number | null }[];
      raidProgression: unknown;
      sourceUrl: string;
    }
  | { ok: false; message: string };

export async function fetchRaiderIoProgress(
  input: RaiderIoCharacterInput,
): Promise<RaiderIoResult> {
  const params = new URLSearchParams({
    region: input.region.toLowerCase(),
    realm: input.realm,
    name: input.characterName,
    fields: 'mythic_plus_scores_by_season:current,mythic_plus_best_runs,raid_progression',
  });

  try {
    const response = await fetch(`https://raider.io/api/v1/characters/profile?${params}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429)
      return { ok: false, message: 'Raider.IO is busy. Please wait and try again later.' };
    if (response.status === 404)
      return { ok: false, message: 'Raider.IO could not find this character.' };
    if (!response.ok)
      return {
        ok: false,
        message: 'Raider.IO progress is unavailable right now. Please try again later.',
      };

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success)
      return {
        ok: false,
        message: 'Raider.IO returned an unexpected response. Please try again later.',
      };

    return {
      ok: true,
      score: parsed.data.mythic_plus_scores_by_season[0]?.scores.all ?? null,
      seasonLabel: parsed.data.mythic_plus_scores_by_season[0]?.season ?? null,
      bestRuns: parsed.data.mythic_plus_best_runs
        .flatMap((run) => {
          const best = bestRunSchema.safeParse(run);
          return best.success
            ? [
                {
                  dungeon: best.data.dungeon,
                  level: best.data.mythic_level,
                  score: typeof best.data.score === 'number' ? best.data.score : null,
                },
              ]
            : [];
        })
        .slice(0, 20),
      raidProgression: parsed.data.raid_progression,
      sourceUrl: parsed.data.profile_url,
    };
  } catch {
    return {
      ok: false,
      message: 'Raider.IO progress is unavailable right now. Please try again later.',
    };
  }
}
