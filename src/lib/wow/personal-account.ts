import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnedWowCharacters } from '@/lib/wow/guild-claim';

export const personalWowCookie = 'lanternmere_personal_wow';
export const personalWowStateSchema = z.object({
  state: z.string().min(32).max(128),
  profileId: z.uuid(),
  region: z.enum(['us', 'eu', 'kr', 'tw']),
  issuedAt: z.number().int(),
});
export async function handlePersonalWowCallback(
  request: NextRequest,
): Promise<NextResponse | null> {
  let session: z.infer<typeof personalWowStateSchema>;
  try {
    session = personalWowStateSchema.parse(
      JSON.parse(
        Buffer.from(request.cookies.get(personalWowCookie)?.value ?? '', 'base64url').toString(),
      ),
    );
  } catch {
    return null;
  }
  const state = request.nextUrl.searchParams.get('state') ?? '';
  const expected = Buffer.from(session.state),
    actual = Buffer.from(state);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const response = (success: boolean) => {
    const result = NextResponse.redirect(
      new URL(`/account?battleNet=${success ? 'connected' : 'failed'}`, request.url),
    );
    result.cookies.set(personalWowCookie, '', { path: '/api', maxAge: 0 });
    result.headers.set('Cache-Control', 'no-store');
    return result;
  };
  const code = request.nextUrl.searchParams.get('code');
  if (!code || session.issuedAt > Date.now() || Date.now() - session.issuedAt > 600000)
    return response(false);
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || user.id !== session.profileId) return response(false);
  try {
    const characters = await getOwnedWowCharacters(session.region, code);
    const { error: saveError } = await createAdminClient().from('app_owned_wow_snapshots').upsert({
      profile_id: user.id,
      region: session.region,
      characters,
      refreshed_at: new Date().toISOString(),
    });
    return response(!saveError);
  } catch {
    return response(false);
  }
}
