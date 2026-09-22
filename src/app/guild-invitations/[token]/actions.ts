'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
export type GuildInvitationAcceptanceState = { error: string | null };
export async function acceptGuildInvitation(
  _: GuildInvitationAcceptanceState,
  formData: FormData,
): Promise<GuildInvitationAcceptanceState> {
  const token = z
    .string()
    .regex(/^[A-Za-z0-9_-]{32,128}$/)
    .safeParse(formData.get('token'));
  if (!token.success) return { error: 'This invitation link is invalid.' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Please sign in before accepting this invitation.' };
    const { data, error } = await supabase.rpc('redeem_guild_invitation', { p_token: token.data });
    if (error || !z.uuid().safeParse(data).success)
      return { error: 'This invitation is unavailable, expired, or belongs to another account.' };
    redirect(`/guild-hall?guild=${data}`);
  } catch {
    return { error: 'This invitation could not be accepted. Please try again.' };
  }
}
