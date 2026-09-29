import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { fetchGuildRoster } from '@/lib/wow/guild-roster';
import {
  getOwnedWowCharacters,
  guildClaimCookie,
  guildClaimStateSchema,
} from '@/lib/wow/guild-claim';

export async function GET(request: NextRequest) {
  const encoded = request.cookies.get(guildClaimCookie)?.value;
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  let claim: ReturnType<typeof guildClaimStateSchema.parse>;
  try {
    claim = guildClaimStateSchema.parse(
      JSON.parse(Buffer.from(encoded ?? '', 'base64url').toString()),
    );
  } catch {
    return new Response('Guild verification session expired. Start again from the Guild Hall.', {
      status: 400,
    });
  }
  const invalid = () =>
    new Response('Guild verification failed. No roles were changed.', { status: 403 });
  const expectedState = Buffer.from(claim.state);
  const returnedState = Buffer.from(state ?? '');
  if (
    !code ||
    !state ||
    expectedState.length !== returnedState.length ||
    !timingSafeEqual(expectedState, returnedState) ||
    Date.now() - claim.issuedAt > 600_000 ||
    claim.issuedAt > Date.now()
  )
    return invalid();

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || user?.id !== claim.profileId) return invalid();

  try {
    const admin = createAdminClient();
    const { data: snapshot, error: snapshotError } = await admin
      .from('guild_blizzard_roster_snapshots')
      .select('region, realm_slug, guild_name')
      .eq('guild_id', claim.guildId)
      .single();
    if (
      snapshotError ||
      !snapshot ||
      snapshot.region !== claim.region ||
      snapshot.realm_slug !== claim.realmSlug ||
      snapshot.guild_name !== claim.guildName
    )
      return invalid();

    const [owned, roster] = await Promise.all([
      getOwnedWowCharacters(claim.region, code),
      fetchGuildRoster({
        region: claim.region,
        realm: claim.realmSlug,
        guildName: claim.guildName,
      }),
    ]);
    if (!roster.ok) return invalid();
    const ownedIds = new Set(owned.map((character) => `${character.realm.slug}:${character.id}`));
    const master = roster.roster.members.find(
      (member) =>
        member.rank === 0 && ownedIds.has(`${member.character.realm.slug}:${member.character.id}`),
    );
    if (!master) return invalid();

    const { error: claimError } = await admin.rpc('claim_verified_guild_master', {
      p_guild_id: claim.guildId,
      p_profile_id: user.id,
      p_character_id: master.character.id,
      p_region: claim.region,
      p_realm_slug: claim.realmSlug,
      p_guild_name: claim.guildName,
    });
    if (claimError) return invalid();
    const response = NextResponse.redirect(
      new URL(`/guild-hall?guild=${claim.guildId}`, request.url),
    );
    response.cookies.delete(guildClaimCookie);
    return response;
  } catch {
    return invalid();
  }
}
