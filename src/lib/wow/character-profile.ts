import 'server-only';

import { z } from 'zod';
import { characterInputSchema } from './character-input';
import { getBlizzardToken } from './blizzard-token';
import { isBlizzardPortrait } from './portrait';
import {
  parseCharacterEquipment,
  parseCharacterRaidEncounters,
  type EquipmentItem,
  type RaidEncounter,
} from './character-details';

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
  // Blizzard records the character's selected presentation separately from class.
  // It is optional here so an incomplete upstream response cannot discard an
  // otherwise valid character import.
  gender: z
    .object({
      type: z.string().min(1),
      name: z.string().min(1),
    })
    .optional()
    .catch(undefined),
  faction: z.object({
    type: z.string().min(1),
    name: z.string().min(1),
  }),
  active_spec: namedRecordSchema.optional(),
  equipped_item_level: z.number().int().nonnegative().optional().catch(undefined),
  average_item_level: z.number().int().nonnegative().optional().catch(undefined),
  achievement_points: z.number().int().nonnegative().optional().catch(undefined),
});

export type CharacterProfile = z.infer<typeof profileSchema> & {
  portrait_url?: string;
  equipment?: EquipmentItem[];
  raid_encounters?: RaidEncounter[];
};

const mediaSchema = z.object({
  character: z.object({ id: z.number().int().positive() }),
  assets: z.array(z.object({ key: z.string(), value: z.string() })),
});

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
      code: 'invalid_input' | 'authentication' | 'unavailable' | 'throttled' | 'integration';
      message: string;
    };

export async function fetchCharacterProfile(input: unknown): Promise<ProfileResult> {
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

  // Media is optional: a missing portrait must not discard a valid profile.
  let portraitUrl: string | undefined;
  try {
    const mediaUrl = new URL(url);
    mediaUrl.pathname += '/character-media';
    const mediaResponse = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (mediaResponse.ok) {
      const media = mediaSchema.safeParse(await mediaResponse.json());
      if (media.success && media.data.character.id === profile.data.id) {
        portraitUrl = media.data.assets.find(
          (asset) => asset.key === 'avatar' && isBlizzardPortrait(asset.value),
        )?.value;
      }
    }
  } catch {
    // Keep the successful profile when media is unavailable or malformed.
  }

  // Each optional endpoint is isolated so one unavailable detail cannot erase
  // the verified public profile or the other successful detail response.
  async function optionalDetails(path: string): Promise<unknown | null> {
    try {
      const detailsUrl = new URL(url);
      detailsUrl.pathname += path;
      const detailsResponse = await fetch(detailsUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      });
      return detailsResponse.ok ? await detailsResponse.json() : null;
    } catch {
      return null;
    }
  }
  const [equipmentBody, raidsBody] = await Promise.all([
    optionalDetails('/equipment'),
    optionalDetails('/encounters/raids'),
  ]);
  const equipment = parseCharacterEquipment(equipmentBody, profile.data.id);
  const raidEncounters = parseCharacterRaidEncounters(raidsBody, profile.data.id);

  return {
    ok: true,
    profile: {
      ...profile.data,
      ...(portraitUrl ? { portrait_url: portraitUrl } : {}),
      ...(equipment ? { equipment } : {}),
      ...(raidEncounters ? { raid_encounters: raidEncounters } : {}),
    },
    region,
    source: 'blizzard',
    fetchedAt: new Date().toISOString(),
  };
}
