import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { guildClaimCookie, guildClaimStateSchema } from '@/lib/wow/guild-claim';

export async function GET(request: NextRequest) {
  const guildId = z.uuid().safeParse(request.nextUrl.searchParams.get('guild'));
  if (!guildId.success) return new Response('Invalid Guild link.', { status: 400 });
  const {
    BLIZZARD_CLIENT_ID: clientId,
    BLIZZARD_CLIENT_SECRET: clientSecret,
    BLIZZARD_REDIRECT_URI: redirectUri,
  } = serverEnv;
  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    new URL(redirectUri).origin !== request.nextUrl.origin ||
    new URL(redirectUri).pathname !== '/api/guild-claim/callback'
  )
    return new Response('Battle.net verification is not configured for this address.', {
      status: 503,
    });

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return new Response('Sign in to Lanternmere first.', { status: 401 });

  const admin = createAdminClient();
  const { data: snapshot, error } = await admin
    .from('guild_blizzard_roster_snapshots')
    .select('region, realm_slug, guild_name')
    .eq('guild_id', guildId.data)
    .maybeSingle();
  const parsed = z
    .object({
      region: z.enum(['us', 'eu', 'kr', 'tw']),
      realm_slug: z.string().min(1),
      guild_name: z.string().min(1),
    })
    .safeParse(snapshot);
  if (error || !parsed.success)
    return new Response('Import the official Guild roster before verification.', { status: 409 });

  const state = randomBytes(32).toString('hex');
  const claim = guildClaimStateSchema.parse({
    state,
    guildId: guildId.data,
    profileId: user.id,
    region: parsed.data.region,
    realmSlug: parsed.data.realm_slug,
    guildName: parsed.data.guild_name,
    issuedAt: Date.now(),
  });
  const authorizeUrl = new URL('/oauth/authorize', `https://${claim.region}.battle.net`);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'wow.profile');
  authorizeUrl.searchParams.set('state', state);
  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(guildClaimCookie, Buffer.from(JSON.stringify(claim)).toString('base64url'), {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/guild-claim',
    maxAge: 600,
  });
  return response;
}
