'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/hearth/context';
import { gameNicknameSchema } from '@/lib/account-nickname';
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
