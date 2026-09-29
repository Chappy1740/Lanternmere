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

const accountProfileSchema = z.object({
  wow_accounts: z.array(
    z.object({
      characters: z.array(
        z.object({
          id: z.number().int().positive(),
          realm: z.object({ slug: z.string().min(1) }),
        }),
      ),
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
  if (!tokenResponse.ok) throw new Error('Battle.net did not authorize this account.');
  const token = z.object({ access_token: z.string().min(1) }).safeParse(await tokenResponse.json());
  if (!token.success) throw new Error('Battle.net did not authorize character access.');

  const profileUrl = new URL('/profile/user/wow', `https://${region}.api.blizzard.com`);
  profileUrl.searchParams.set('namespace', `profile-${region}`);
  const profileResponse = await fetch(profileUrl, {
    headers: { Authorization: `Bearer ${token.data.access_token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!profileResponse.ok) throw new Error('Battle.net account characters are unavailable.');
  const profile = accountProfileSchema.safeParse(await profileResponse.json());
  if (!profile.success) throw new Error('Battle.net returned an unexpected account profile.');
  return profile.data.wow_accounts.flatMap((account) => account.characters);
}
