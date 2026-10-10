'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';

export type DirectoryPreferenceState = { error: string | null; success: string | null };

const preferenceSchema = z.discriminatedUnion('visible', [
  z.object({ visible: z.literal('false') }),
  z.object({
    visible: z.literal('true'),
    alias: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[^@\p{Cc}\p{Cf}]+$/u),
  }),
]);

export async function updateDirectoryPreference(
  _previous: DirectoryPreferenceState,
  formData: FormData,
): Promise<DirectoryPreferenceState> {
  const parsed = preferenceSchema.safeParse({
    visible: formData.get('visible'),
    alias: formData.get('alias'),
  });
  if (!parsed.success)
    return { error: 'Choose an alias of 2–32 characters without an email address.', success: null };

  const { supabase, user } = await getViewer();
  const visible = parsed.data.visible === 'true';
  const { error } = await supabase.from('app_member_directory_preferences').upsert({
    profile_id: user.id,
    alias: parsed.data.visible === 'true' ? parsed.data.alias : null,
    visible_to_owner: visible,
  });
  if (error) return { error: 'Your directory preference could not be saved.', success: null };
  revalidatePath('/membership');
  return {
    error: null,
    success: visible
      ? 'Your alias is visible to the app owner.'
      : 'Your alias is hidden from the app owner.',
  };
}

export type MainIdentityConsentState = { error: string | null; success: string | null };

export async function acknowledgeMainIdentity(
  _previous: MainIdentityConsentState,
  formData: FormData,
): Promise<MainIdentityConsentState> {
  if (formData.get('acknowledgeMainIdentity') !== 'yes')
    return {
      error: 'Confirm that the app owner may see your verified Main identity.',
      success: null,
    };
  const { supabase, user } = await getViewer();
  const { error } = await supabase
    .from('app_main_identity_acknowledgments')
    .insert({ profile_id: user.id });
  if (error && error.code !== '23505')
    return { error: 'Your acknowledgment could not be saved. Please try again.', success: null };
  revalidatePath('/membership');
  revalidatePath('/account');
  return { error: null, success: 'Main identity acknowledgment saved.' };
}
