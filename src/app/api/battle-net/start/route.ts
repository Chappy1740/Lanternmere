import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { serverEnv } from '@/lib/env.server';
import { createClient } from '@/lib/supabase/server';
import { personalWowCookie, personalWowStateSchema } from '@/lib/wow/personal-account';
export async function GET(request: NextRequest) {
  const region = z
    .enum(['us', 'eu', 'kr', 'tw'])
    .safeParse(request.nextUrl.searchParams.get('region') ?? 'us');
  if (!region.success)
    return new Response('Choose a supported Battle.net region.', { status: 400 });
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
    return new Response('Battle.net connection is not configured for this address.', {
      status: 503,
    });
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return new Response('Sign in before connecting Battle.net.', { status: 401 });
  const session = personalWowStateSchema.parse({
    state: randomBytes(32).toString('hex'),
    profileId: user.id,
    region: region.data,
    issuedAt: Date.now(),
  });
  const url = new URL('/oauth/authorize', `https://${region.data}.battle.net`);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'wow.profile',
    state: session.state,
  }).toString();
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(
    personalWowCookie,
    Buffer.from(JSON.stringify(session)).toString('base64url'),
    {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/api',
      maxAge: 600,
    },
  );
  return response;
}
