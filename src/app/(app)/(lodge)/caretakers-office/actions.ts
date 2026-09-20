'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createInvitationToken, hashInvitationToken } from '@/lib/lodge-invitations';
import { createClient } from '@/lib/supabase/server';

export type CaretakerState = {
  error: string | null;
  success: string | null;
  invitationPath?: string;
  email?: string;
};

const invitationInput = z.object({
  lodgeId: z.uuid(),
  email: z.string().trim().max(320).email().or(z.literal('')),
  role: z.enum(['member', 'guest']),
});
const roleInput = z.object({
  membershipId: z.uuid(),
  role: z.enum(['caretaker', 'member', 'guest']),
});
const invitationId = z.uuid();

async function session() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return error || !user ? null : { supabase, user };
  } catch {
    return null;
  }
}

async function isOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lodgeId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('lodge_members')
    .select('role')
    .eq('lodge_id', lodgeId)
    .eq('profile_id', userId)
    .maybeSingle();
  return !error && data?.role === 'owner';
}

function refresh() {
  revalidatePath('/caretakers-office');
  revalidatePath('/hearth');
}

export async function createLodgeInvitation(
  _: CaretakerState,
  formData: FormData,
): Promise<CaretakerState> {
  const parsed = invitationInput.safeParse({
    lodgeId: formData.get('lodgeId'),
    email: formData.get('email') ?? '',
    role: formData.get('role'),
  });
  if (!parsed.success)
    return { error: 'Enter a valid email address or leave it blank.', success: null };
  const current = await session();
  if (!current || !(await isOwner(current.supabase, parsed.data.lodgeId, current.user.id)))
    return { error: 'Only the Lodge owner can create invitations.', success: null };

  const token = createInvitationToken();
  const email = parsed.data.email ? parsed.data.email.toLocaleLowerCase() : null;
  const { error } = await current.supabase.from('lodge_invitations').insert({
    lodge_id: parsed.data.lodgeId,
    created_by: current.user.id,
    email,
    role: parsed.data.role,
    token_hash: hashInvitationToken(token),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error)
    return { error: 'The invitation could not be created. Please try again.', success: null };
  refresh();
  return {
    error: null,
    success: 'Invitation created. It expires in seven days.',
    invitationPath: `/invitations/${token}`,
    email: email ?? undefined,
  };
}

export async function revokeLodgeInvitation(
  _: CaretakerState,
  formData: FormData,
): Promise<CaretakerState> {
  const id = invitationId.safeParse(formData.get('invitationId'));
  if (!id.success) return { error: 'Choose a valid invitation.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before revoking an invitation.', success: null };
  const { data: invitation, error: readError } = await current.supabase
    .from('lodge_invitations')
    .select('id, lodge_id')
    .eq('id', id.data)
    .maybeSingle();
  if (
    readError ||
    !invitation ||
    !(await isOwner(current.supabase, invitation.lodge_id, current.user.id))
  )
    return { error: 'Only the Lodge owner can revoke this invitation.', success: null };
  const { error } = await current.supabase
    .from('lodge_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitation.id)
    .is('accepted_at', null)
    .is('revoked_at', null);
  if (error)
    return { error: 'The invitation could not be revoked. Please try again.', success: null };
  refresh();
  return { error: null, success: 'Invitation revoked.' };
}

export async function updateLodgeMemberRole(
  _: CaretakerState,
  formData: FormData,
): Promise<CaretakerState> {
  const parsed = roleInput.safeParse({
    membershipId: formData.get('membershipId'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: 'Choose a valid Lodge role.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before changing a role.', success: null };
  const { data: membership, error: readError } = await current.supabase
    .from('lodge_members')
    .select('id, lodge_id, role')
    .eq('id', parsed.data.membershipId)
    .maybeSingle();
  if (
    readError ||
    !membership ||
    membership.role === 'owner' ||
    !(await isOwner(current.supabase, membership.lodge_id, current.user.id))
  )
    return { error: 'Only the Lodge owner can change this role.', success: null };
  const { error } = await current.supabase
    .from('lodge_members')
    .update({ role: parsed.data.role })
    .eq('id', membership.id);
  if (error)
    return { error: 'The Lodge role could not be updated. Please try again.', success: null };
  refresh();
  return { error: null, success: 'Lodge role updated.' };
}
