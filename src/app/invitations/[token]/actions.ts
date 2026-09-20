'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type InvitationAcceptanceState = { error: string | null };
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);

export async function acceptLodgeInvitation(
  _: InvitationAcceptanceState,
  formData: FormData,
): Promise<InvitationAcceptanceState> {
  const token = tokenSchema.safeParse(formData.get('token'));
  if (!token.success) return { error: 'This invitation link is invalid.' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Please sign in before accepting this invitation.' };
    const { data: lodgeId, error } = await supabase.rpc('redeem_lodge_invitation', {
      p_token: token.data,
    });
    if (error || !z.uuid().safeParse(lodgeId).success)
      return { error: 'This invitation is unavailable, expired, or belongs to another account.' };
    revalidatePath('/hearth');
    revalidatePath('/caretakers-office');
    redirect(`/hearth?lodge=${lodgeId}`);
  } catch {
    return { error: 'This invitation could not be accepted. Please try again.' };
  }
}
