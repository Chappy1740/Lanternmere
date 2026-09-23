'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createInvitationToken, hashInvitationToken } from '@/lib/lodge-invitations';
import { createClient } from '@/lib/supabase/server';

export type CaretakerState = {
  error: string | null;
  success: string | null;
  invitationPath?: string;
  email?: string;
};

export type LodgeManagementState = { error: string | null; success: string | null };

function refreshManagement() {
  revalidatePath('/caretakers-office');
  revalidatePath('/hearth');
}

export async function leaveLodge(_: LodgeManagementState, formData: FormData): Promise<LodgeManagementState> {
  const lodgeId = z.uuid().safeParse(formData.get('lodgeId'));
  if (!lodgeId.success) return { error: 'That Lodge is unavailable.', success: null };
  const { error } = await (await createClient()).rpc('leave_lodge', { p_lodge_id: lodgeId.data });
  if (error) return { error: 'Owners must transfer ownership or delete the Lodge before leaving.', success: null };
  refreshManagement();
  return { error: null, success: 'You left this Lodge.' };
}

export async function removeLodgeMember(_: LodgeManagementState, formData: FormData): Promise<LodgeManagementState> {
  const membershipId = z.uuid().safeParse(formData.get('membershipId'));
  if (!membershipId.success) return { error: 'That member is unavailable.', success: null };
  const { error } = await (await createClient()).rpc('remove_lodge_member', { p_membership_id: membershipId.data });
  if (error) return { error: 'Only the Lodge owner can remove non-owner members.', success: null };
  refreshManagement();
  return { error: null, success: 'Member removed and their character sharing revoked.' };
}

export async function requestLodgeOwnershipTransfer(_: LodgeManagementState, formData: FormData): Promise<LodgeManagementState> {
  const membershipId = z.uuid().safeParse(formData.get('toMembershipId'));
  if (!membershipId.success) return { error: 'Choose another Lodge member.', success: null };
  const { error } = await (await createClient()).rpc('request_lodge_ownership_transfer', { p_to_membership_id: membershipId.data });
  if (error) return { error: 'The ownership transfer could not be started.', success: null };
  refreshManagement();
  return { error: null, success: 'Transfer requested. The recipient must explicitly accept it.' };
}

export async function acceptLodgeOwnershipTransfer(_: LodgeManagementState, formData: FormData): Promise<LodgeManagementState> {
  const transferId = z.uuid().safeParse(formData.get('transferId'));
  if (!transferId.success) return { error: 'That transfer is unavailable.', success: null };
  const { error } = await (await createClient()).rpc('accept_lodge_ownership_transfer', { p_transfer_id: transferId.data });
  if (error) return { error: 'That ownership transfer is unavailable.', success: null };
  refreshManagement();
  return { error: null, success: 'Lodge ownership accepted.' };
}

export async function cancelLodgeOwnershipTransfer(_: LodgeManagementState, formData: FormData): Promise<LodgeManagementState> {
  const transferId = z.uuid().safeParse(formData.get('transferId'));
  if (!transferId.success) return { error: 'That transfer is unavailable.', success: null };
  const { error } = await (await createClient()).rpc('cancel_lodge_ownership_transfer', { p_transfer_id: transferId.data });
  if (error) return { error: 'Only the current owner can cancel this transfer.', success: null };
  refreshManagement();
  return { error: null, success: 'Ownership transfer canceled.' };
}

export async function deleteLodge(_: LodgeManagementState, formData: FormData): Promise<LodgeManagementState> {
  const lodgeId = z.uuid().safeParse(formData.get('lodgeId'));
  const confirmation = z.string().max(200).safeParse(formData.get('confirmation'));
  if (!lodgeId.success || !confirmation.success) return { error: 'Confirm the Lodge name to delete it.', success: null };
  const { error } = await (await createClient()).rpc('delete_lodge', { p_lodge_id: lodgeId.data, p_confirmation: confirmation.data });
  if (error) return { error: 'Only the owner can delete a Lodge after entering its exact name.', success: null };
  refreshManagement();
  redirect('/lodges/new');
}

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
