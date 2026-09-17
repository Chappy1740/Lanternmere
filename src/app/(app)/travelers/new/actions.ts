'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchCharacterProfile } from '@/lib/wow/character-profile';
import { characterInputSchema } from '@/lib/wow/character-input';

export type AddCharacterState = {
  error: string | null;
};

export async function addCharacter(
  _previousState: AddCharacterState,
  formData: FormData,
): Promise<AddCharacterState> {
  let characterId: string;
  let existingCharacterId: string | undefined;
  const attemptedAt = new Date().toISOString();

  async function failure(message: string, code: string): Promise<AddCharacterState> {
    if (existingCharacterId) {
      try {
        const { error } = await createAdminClient().from('character_refresh_failures').insert({
          character_id: existingCharacterId,
          attempted_at: attemptedAt,
          failure_code: code,
        });
        if (error) throw new Error('Status unavailable');
        revalidatePath('/travelers');
        revalidatePath(`/travelers/${existingCharacterId}`);
        revalidatePath('/hearth');
      } catch {
        return { error: `${message} Refresh status could not be saved.` };
      }
    }
    return { error: message };
  }

  try {
    // Verify the user's session with the ordinary, cookie-based client.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Please sign in before adding a character.' };
    }

    // The form supplies identifiers only, never profile data or an owner ID.
    const input = characterInputSchema.safeParse({
      region: formData.get('region'),
      realm: formData.get('realm'),
      characterName: formData.get('characterName'),
    });
    if (!input.success) {
      return { error: input.error.issues[0]?.message ?? 'Check the character details.' };
    }

    // Resolve only the verified user's saved WoW character before recording failures.
    const existing = await supabase
      .from('characters')
      .select('id, games!inner(slug)')
      .eq('profile_id', user.id)
      .eq('games.slug', 'wow')
      .eq('region', input.data.region)
      .eq('realm_slug', input.data.realm)
      .eq('character_name', input.data.characterName)
      .maybeSingle();
    if (existing.error)
      return { error: 'Unable to check your saved characters. Please try again.' };
    if (existing.data) existingCharacterId = z.uuid().parse(existing.data.id);

    const result = await fetchCharacterProfile(input.data);

    if (!result.ok) {
      return failure(result.message, result.code === 'invalid_input' ? 'integration' : result.code);
    }

    // Write the official response using the server-only client.
    // Ownership comes exclusively from the verified session above.
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('save_verified_wow_character', {
      p_profile_id: user.id,
      p_region: result.region,
      p_profile: result.profile,
      p_fetched_at: result.fetchedAt,
    });

    if (error) {
      return failure('The character could not be saved. Please try again.', 'save');
    }

    const savedId = z.uuid().safeParse(data);

    if (!savedId.success) {
      return {
        error: 'The save returned an unexpected response. Check Travelers before trying again.',
      };
    }

    characterId = savedId.data;
  } catch {
    return failure('The request could not be completed. Please try again.', 'integration');
  }

  revalidatePath('/travelers');
  revalidatePath('/hearth');
  revalidatePath(`/travelers/${characterId}`);
  redirect(`/travelers/${characterId}`);
}
