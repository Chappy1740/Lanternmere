'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { gameNicknameSchema } from '@/lib/account-nickname';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchCharacterProfile } from '@/lib/wow/character-profile';
import { ownedWowCharacterSchema } from '@/lib/wow/guild-claim';
import { WOW_MIN_TRAVELER_LEVEL } from '@/lib/wow/level';

export type AddOwnedTravelerState = { error: string | null };

export async function addOwnedTraveler(
  _previous: AddOwnedTravelerState,
  form: FormData,
): Promise<AddOwnedTravelerState> {
  const requested = z.coerce.number().int().positive().safeParse(form.get('characterId'));
  if (!requested.success) return { error: 'Choose a character from your Battle.net list.' };
  const { supabase, user } = await getViewer();
  const { data: snapshot, error: snapshotError } = await supabase
    .from('app_owned_wow_snapshots')
    .select('region,characters,refreshed_at')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (snapshotError || !snapshot) return { error: 'Connect Battle.net before adding a Traveler.' };
  const snapshotAge = Date.now() - Date.parse(snapshot.refreshed_at);
  if (!Number.isFinite(snapshotAge) || snapshotAge < 0 || snapshotAge > 24 * 60 * 60 * 1000)
    return { error: 'Refresh your Battle.net list before adding a Traveler.' };
  const parsed = z.array(ownedWowCharacterSchema).safeParse(snapshot.characters);
  const owned = parsed.success
    ? parsed.data.find((character) => character.id === requested.data)
    : undefined;
  if (!owned?.name || owned.level === undefined || owned.level < WOW_MIN_TRAVELER_LEVEL)
    return { error: 'This character is not available in your eligible Battle.net list.' };
  const admin = createAdminClient();
  const { data: allowed, error: limitError } = await admin.rpc('claim_wow_profile_fetch', {
    p_profile_id: user.id,
    p_region: snapshot.region,
    p_realm_slug: owned.realm.slug,
    p_character_name: owned.name.toLowerCase(),
  });
  if (limitError) return { error: 'The character could not be checked right now.' };
  if (!allowed) return { error: 'This character can be checked again in five minutes.' };
  const result = await fetchCharacterProfile({
    region: snapshot.region,
    realm: owned.realm.slug,
    characterName: owned.name,
  });
  if (!result.ok) return { error: result.message };
  if (
    result.profile.id !== owned.id ||
    result.profile.realm.slug.toLowerCase() !== owned.realm.slug.toLowerCase() ||
    result.profile.name.toLowerCase() !== owned.name.toLowerCase()
  )
    return { error: 'Battle.net returned a different character. Refresh your list and try again.' };
  const { data: savedId, error } = await admin.rpc('claim_owned_wow_character', {
    p_profile_id: user.id,
    p_region: result.region,
    p_profile: result.profile,
    p_fetched_at: result.fetchedAt,
  });
  if (error?.code === '23505')
    return {
      error: 'This character has already been claimed. Contact the app owner if this is yours.',
    };
  if (error)
    return {
      error: 'This Traveler could not be saved. Refresh your Battle.net list and try again.',
    };
  const saved = z.uuid().safeParse(savedId);
  if (!saved.success)
    return { error: 'The Traveler was saved, but its page could not be opened. Check Travelers.' };
  const { data: character } = await supabase
    .from('characters')
    .select('is_main')
    .eq('profile_id', user.id)
    .eq('id', saved.data)
    .maybeSingle();
  revalidatePath('/account');
  revalidatePath('/travelers');
  revalidatePath('/hearth');
  revalidatePath(`/travelers/${saved.data}`);
  redirect(character?.is_main ? '/hearth' : `/travelers/${saved.data}`);
}
export async function updateGameNickname(
  _previous: { error: string | null; success: string | null },
  form: FormData,
): Promise<{ error: string | null; success: string | null }> {
  const parsed = gameNicknameSchema.safeParse(form.get('nickname'));
  if (!parsed.success)
    return {
      error: 'Choose a game nickname of 2–32 characters without an email address.',
      success: null,
    };
  const { supabase, user } = await getViewer();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data })
    .eq('id', user.id);
  if (error) return { error: 'Your nickname could not be saved.', success: null };
  revalidatePath('/account');
  return { error: null, success: 'Your game nickname is saved. Directory sharing is unchanged.' };
}
