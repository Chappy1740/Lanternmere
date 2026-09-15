'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchCharacterProfile } from '@/lib/wow/character-profile';

export type AddCharacterState = {
  error: string | null;
};

export async function addCharacter(
  _previousState: AddCharacterState,
  formData: FormData,
): Promise<AddCharacterState> {
  let characterId: string;

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
    const result = await fetchCharacterProfile({
      region: formData.get('region'),
      realm: formData.get('realm'),
      characterName: formData.get('characterName'),
    });

    if (!result.ok) {
      return { error: result.message };
    }

    // Write the official response using the server-only client.
    // Ownership comes exclusively from the verified session above.
    const admin = createAdminClient();
    const { data, error } = await admin.rpc(
      'save_verified_wow_character',
      {
        p_profile_id: user.id,
        p_region: result.region,
        p_profile: result.profile,
        p_fetched_at: result.fetchedAt,
      },
    );

    if (error) {
      return {
        error: 'The character could not be saved. Please try again.',
      };
    }

    const savedId = z.uuid().safeParse(data);

    if (!savedId.success) {
      return {
        error:
          'The save returned an unexpected response. Check Travelers before trying again.',
      };
    }

    characterId = savedId.data;
  } catch {
    return {
      error: 'The request could not be completed. Please try again.',
    };
  }

  revalidatePath('/travelers');
  revalidatePath(`/travelers/${characterId}`);
  redirect(`/travelers/${characterId}`);
}