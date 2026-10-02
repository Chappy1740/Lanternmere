'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { serverEnv } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';

export type AccountAccessState = { error: string | null; success: string | null };
export async function setAccountAccess(
  _previous: AccountAccessState,
  form: FormData,
): Promise<AccountAccessState> {
  const { user } = await getViewer();
  if (!serverEnv.APP_OWNER_PROFILE_ID || user.id !== serverEnv.APP_OWNER_PROFILE_ID)
    return { error: 'Owner access is required.', success: null };
  const parsed = z
    .object({
      profileId: z.uuid(),
      action: z.enum(['suspend', 'restore']),
      confirm: z.literal('on'),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Confirm the account access change.', success: null };
  if (parsed.data.profileId === user.id)
    return { error: 'You cannot suspend your owner account.', success: null };
  const { error } = await createAdminClient().rpc('set_app_account_access', {
    p_actor_id: user.id,
    p_profile_id: parsed.data.profileId,
    p_suspended: parsed.data.action === 'suspend',
  });
  if (error) return { error: 'Account access could not be changed.', success: null };
  revalidatePath('/owner/accounts');
  return {
    error: null,
    success:
      parsed.data.action === 'suspend' ? 'Account access suspended.' : 'Account access restored.',
  };
}
