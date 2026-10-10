import { createHash } from 'node:crypto';
import { z } from 'zod';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';

export function ownerAccountReference(profileId: string) {
  return `Member ${createHash('sha256').update(profileId).digest('hex').slice(0, 10).toUpperCase()}`;
}

// Call only after the request's app-owner gate. Verify it again here because
// this function uses the server credential to read across account boundaries.
export async function ownerMainIdentities(viewerId: string, profileIds: string[]) {
  if (!serverEnv.APP_OWNER_PROFILE_ID || viewerId !== serverEnv.APP_OWNER_PROFILE_ID)
    throw new Error('Owner access required.');
  if (profileIds.length > 50 || profileIds.some((id) => !z.uuid().safeParse(id).success))
    throw new Error('Invalid account page.');
  const labels = new Map<string, string>();
  if (!profileIds.length) return labels;
  const admin = createAdminClient();
  const [{ data: acknowledgments, error: ackError }, { data: mains, error: mainError }] =
    await Promise.all([
      admin
        .from('app_main_identity_acknowledgments')
        .select('profile_id')
        .eq('policy_version', '2026-10')
        .in('profile_id', profileIds),
      admin
        .from('characters')
        .select('id,profile_id,character_name,realm_slug,region')
        .in('profile_id', profileIds)
        .eq('is_main', true),
    ]);
  const ackRows = z.array(z.object({ profile_id: z.uuid() })).safeParse(acknowledgments);
  const mainRows = z
    .array(
      z.object({
        id: z.uuid(),
        profile_id: z.uuid(),
        character_name: z.string(),
        realm_slug: z.string(),
        region: z.string(),
      }),
    )
    .safeParse(mains);
  if (ackError || mainError || !ackRows.success || !mainRows.success)
    throw new Error('Unable to load owner account labels.');
  const accepted = new Set(ackRows.data.map((row) => row.profile_id));
  const eligibleMains = mainRows.data.filter((main) => accepted.has(main.profile_id));
  if (!eligibleMains.length) return labels;
  const { data: claims, error: claimError } = await admin
    .from('wow_character_claims')
    .select('profile_id,character_id,character_name,realm_slug,region')
    .in(
      'character_id',
      eligibleMains.map((main) => main.id),
    );
  const claimRows = z
    .array(
      z.object({
        profile_id: z.uuid(),
        character_id: z.uuid(),
        character_name: z.string(),
        realm_slug: z.string(),
        region: z.string(),
      }),
    )
    .safeParse(claims);
  if (claimError || !claimRows.success) throw new Error('Unable to verify owner account labels.');
  const claimByCharacter = new Map(claimRows.data.map((claim) => [claim.character_id, claim]));
  for (const main of eligibleMains) {
    const claim = claimByCharacter.get(main.id);
    if (
      claim?.profile_id !== main.profile_id ||
      claim.region !== main.region ||
      claim.realm_slug !== main.realm_slug.toLowerCase() ||
      claim.character_name !== main.character_name.toLowerCase()
    )
      continue;
    labels.set(
      main.profile_id,
      `${main.character_name} · ${main.realm_slug} (${main.region.toUpperCase()})`,
    );
  }
  return labels;
}
