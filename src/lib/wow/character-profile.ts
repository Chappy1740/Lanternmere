import 'server-only';

import { z } from 'zod';
import { characterInputSchema } from './character-input';
import { getBlizzardToken } from './blizzard-token';

const namedRecordSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
});

const profileSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  realm: namedRecordSchema.extend({
    slug: z.string().min(1),
  }),
  level: z.number().int().nonnegative(),
  character_class: namedRecordSchema,
  race: namedRecordSchema,
  faction: z.object({
    type: z.string().min(1),
    name: z.string().min(1),
  }),
  active_spec: namedRecordSchema.optional(),
});

export type CharacterProfile = z.infer<typeof profileSchema>;

export type ProfileResult =
  | {
      ok: true;
      profile: CharacterProfile;
      region: 'us' | 'eu' | 'kr' | 'tw';
      source: 'blizzard';
      fetchedAt: string;
    }
  | {
      ok: false;
      code:
        | 'invalid_input'
        | 'authentication'
        | 'unavailable'
        | 'throttled'
        | 'integration';
      message: string;
    };

export async function fetchCharacterProfile(
  input: unknown,
): Promise<ProfileResult> {
  const parsed = characterInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid_input',
      message: parsed.error.issues[0]?.message ?? 'Check the character details.',
    };
  }

  const { region, realm, characterName } = parsed.data;

  let token: string;

  try {
    token = await getBlizzardToken();
  } catch {
    return {
      ok: false,
      code: 'authentication',
      message: 'Unable to connect to Blizzard authentication. Try again later.',
    };
  }

  const url = new URL(
    `/profile/wow/character/${encodeURIComponent(realm)}/${encodeURIComponent(characterName)}`,
    `https://${region}.api.blizzard.com`,
  );
  url.searchParams.set('namespace', `profile-${region}`);
  url.searchParams.set('locale', 'en_US');

  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return {
      ok: false,
      code: 'integration',
      message: 'Blizzard could not be reached. Try again later.',
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      code: 'throttled',
      message: 'Blizzard is limiting requests. Please try again later.',
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      code: 'unavailable',
      message:
        'This profile is unavailable. Check the region, realm, and name. The profile may also be inactive or private.',
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      code: 'authentication',
      message: 'Blizzard denied access to this profile. Please try again later.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'integration',
      message: 'Blizzard returned an error. Please try again later.',
    };
  }

  const body: unknown = await response.json().catch(() => null);
  const profile = profileSchema.safeParse(body);

  if (!profile.success) {
    return {
      ok: false,
      code: 'integration',
      message: 'Blizzard returned an unexpected character profile.',
    };
  }

  return {
    ok: true,
    profile: profile.data,
    region,
    source: 'blizzard',
    fetchedAt: new Date().toISOString(),
  };
}