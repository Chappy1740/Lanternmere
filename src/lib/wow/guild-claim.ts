import 'server-only';

import { z } from 'zod';
import { serverEnv } from '@/lib/env.server';

export const guildClaimCookie = 'lanternmere_guild_claim';

export const guildClaimStateSchema = z.object({
  state: z.string().min(32),
  guildId: z.uuid(),
  profileId: z.uuid(),
  region: z.enum(['us', 'eu', 'kr', 'tw']),
  realmSlug: z.string().min(1),
  guildName: z.string().min(1),
  issuedAt: z.number().int(),
});

const localizedNameSchema = z.union([
  z.string().max(128),
  z
    .record(z.string(), z.string().max(128))
    .transform((names) => names.en_US ?? names.en_GB ?? Object.values(names)[0] ?? ''),
]);
export class WowAccountProfileError extends Error {
  constructor(
    public readonly stage: 'authorization' | 'token' | 'profile' | 'format',
    public readonly status?: number,
  ) {
    super('Battle.net account profile request failed.');
  }
}
export const ownedWowCharacterSchema = z.object({
  id: z.number().int().positive(),
  name: localizedNameSchema.optional(),
  level: z.number().int().nonnegative().optional(),
  realm: z.object({ slug: z.string().min(1).max(128), name: localizedNameSchema.optional() }),
});
const accountProfileSchema = z.object({
  wow_accounts: z.array(
    z.object({
      characters: z.array(ownedWowCharacterSchema).max(5000),
    }),
  ),
});

export async function getOwnedWowCharacters(region: string, authorizationCode: string) {
  const {
    BLIZZARD_CLIENT_ID: clientId,
    BLIZZARD_CLIENT_SECRET: clientSecret,
    BLIZZARD_REDIRECT_URI: redirectUri,
  } = serverEnv;
  if (!clientId || !clientSecret || !redirectUri)
    throw new Error('Battle.net verification is not configured.');

  const tokenResponse = await fetch(`https://${region}.battle.net/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenResponse.ok) throw new WowAccountProfileError('authorization', tokenResponse.status);
  const token = z.object({ access_token: z.string().min(1) }).safeParse(await tokenResponse.json());
  if (!token.success) throw new WowAccountProfileError('token');

  const profileUrl = new URL('/profile/user/wow', `https://${region}.api.blizzard.com`);
  profileUrl.searchParams.set('namespace', `profile-${region}`);
  profileUrl.searchParams.set(
    'locale',
    region === 'kr' ? 'ko_KR' : region === 'tw' ? 'zh_TW' : 'en_US',
  );
  const profileResponse = await fetch(profileUrl, {
    headers: { Authorization: `Bearer ${token.data.access_token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!profileResponse.ok) throw new WowAccountProfileError('profile', profileResponse.status);
  const profile = accountProfileSchema.safeParse(await profileResponse.json());
  if (!profile.success) throw new WowAccountProfileError('format');
  return profile.data.wow_accounts.flatMap((account) => account.characters);
}
