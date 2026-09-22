import 'server-only';
import { z } from 'zod';
import { getBlizzardToken } from './blizzard-token';
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/[’']/g, '').replace(/\s+/g, '-'))
  .pipe(
    z
      .string()
      .regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u)
      .min(1)
      .max(80),
  );
const inputSchema = z.object({
  region: z.enum(['us', 'eu', 'kr', 'tw']),
  realm: slug,
  guildName: slug,
});
const rosterSchema = z.object({
  members: z.array(
    z.object({
      character: z.object({
        id: z.number(),
        name: z.string(),
        realm: z.object({ slug: z.string() }),
        playable_class: z
          .object({ id: z.number().int(), name: z.string().optional() })
          .optional()
          .catch(undefined),
      }),
      rank: z.number().int().nonnegative(),
    }),
  ),
});
const classes: Record<number, string> = {
  1: 'Warrior',
  2: 'Paladin',
  3: 'Hunter',
  4: 'Rogue',
  5: 'Priest',
  6: 'Death Knight',
  7: 'Shaman',
  8: 'Mage',
  9: 'Warlock',
  10: 'Monk',
  11: 'Druid',
  12: 'Demon Hunter',
  13: 'Evoker',
};
export async function fetchGuildRoster(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false as const, message: 'Check the region, realm, and Guild name.' };
  try {
    const token = await getBlizzardToken();
    const url = new URL(
      `/data/wow/guild/${encodeURIComponent(parsed.data.realm)}/${encodeURIComponent(parsed.data.guildName)}/roster`,
      `https://${parsed.data.region}.api.blizzard.com`,
    );
    url.searchParams.set('namespace', `profile-${parsed.data.region}`);
    url.searchParams.set('locale', 'en_US');
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      return {
        ok: false as const,
        message:
          response.status === 404
            ? 'That official Guild roster was not found.'
            : 'Blizzard could not provide this Guild roster.',
      };
    const roster = rosterSchema.safeParse(await response.json());
    if (!roster.success)
      return { ok: false as const, message: 'Blizzard returned an unexpected Guild roster.' };
    return {
      ok: true as const,
      region: parsed.data.region,
      sourceUrl: url.toString(),
      fetchedAt: new Date().toISOString(),
      roster: {
        ...roster.data,
        members: roster.data.members.map((member) => ({
          ...member,
          character: {
            ...member.character,
            playable_class: member.character.playable_class
              ? {
                  ...member.character.playable_class,
                  name:
                    member.character.playable_class.name ??
                    classes[member.character.playable_class.id],
                }
              : undefined,
          },
        })),
      },
    };
  } catch {
    return { ok: false as const, message: 'Blizzard could not be reached. Try again later.' };
  }
}
