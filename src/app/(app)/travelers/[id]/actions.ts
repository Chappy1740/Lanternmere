'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type CharacterStatusState = {
  error: string | null;
  success: string | null;
};

export async function makeMainCharacter(
  _previousState: CharacterStatusState,
  formData: FormData,
): Promise<CharacterStatusState> {
  const parsed = z.uuid().safeParse(formData.get('characterId'));

  if (!parsed.success) {
    return { error: 'Choose a valid character.', success: null };
  }

  const characterId = parsed.data;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: 'Please sign in before choosing your main character.',
        success: null,
      };
    }

    const { data, error } = await supabase.rpc('set_main_character', {
      p_character_id: characterId,
    });

    if (error || data !== characterId) {
      return {
        error:
          'Unable to change your main. Choose one of your own saved characters and try again.',
        success: null,
      };
    }
  } catch {
    return {
      error: 'The request could not be completed. Please try again.',
      success: null,
    };
  }

  // Refresh the list and all details, including the previous main.
  revalidatePath('/travelers');
  revalidatePath('/travelers/[id]', 'page');

  return {
    error: null,
    success: 'Main character updated. Your previous main is now an Alternate.',
  };
}