'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type LodgeSharingState = {
  error: string | null;
  success: string | null;
};

const sharingInputSchema = z.object({
  characterId: z.uuid(),
  lodgeIds: z.array(z.uuid()),
});

export async function updateLodgeSharing(
  _previousState: LodgeSharingState,
  formData: FormData,
): Promise<LodgeSharingState> {
  const parsed = sharingInputSchema.safeParse({
    characterId: formData.get('characterId'),
    lodgeIds: formData.getAll('lodgeIds'),
  });

  if (!parsed.success) {
    return {
      error: 'Check your character and Lodge selections.',
      success: null,
    };
  }

  const { characterId, lodgeIds } = parsed.data;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: 'Please sign in before changing Lodge sharing.',
        success: null,
      };
    }

    const { data, error } = await supabase.rpc('set_character_lodge_sharing', {
      p_character_id: characterId,
      p_lodge_ids: [...new Set(lodgeIds)],
    });

    if (error || data !== characterId) {
      return {
        error:
          'Unable to save sharing. You must own the saved character and belong to every selected Lodge.',
        success: null,
      };
    }
  } catch {
    return {
      error: 'The request could not be completed. Please try again.',
      success: null,
    };
  }

  revalidatePath('/travelers');
  revalidatePath('/hearth');
  revalidatePath('/travelers/[id]', 'page');

  return {
    error: null,
    success:
      lodgeIds.length === 0
        ? 'Character sharing removed from all Lodges.'
        : 'Lodge sharing updated.',
  };
}
