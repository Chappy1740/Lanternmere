'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createInvitationToken, hashInvitationToken } from '@/lib/lodge-invitations';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchGuildRoster } from '@/lib/wow/guild-roster';

export type GuildCreationState = { error: string | null };
export type GuildMemberPortalState = { error: string | null; success: string | null };
export type GuildInvitationState = {
  error: string | null;
  success: string | null;
  invitationPath?: string;
};
export type GuildRosterImportState = { error: string | null; success: string | null };
export type GuildMemberRoleState = { error: string | null; success: string | null };
export type GuildOwnershipTransferState = { error: string | null; success: string | null };
export type GuildDepartureState = { error: string | null; success: string | null };
export type GuildSharingState = { error: string | null; success: string | null };
export type GuildRaidOperationState = { error: string | null; success: string | null };

const guildRaidOperationInput = z.object({ guildId: z.uuid(), eventId: z.uuid() });
export async function createGuildRaidOperation(_: GuildRaidOperationState, formData: FormData) {
  const parsed = guildRaidOperationInput.safeParse({
    guildId: formData.get('guildId'),
    eventId: formData.get('eventId'),
  });
  if (!parsed.success) return { error: 'Choose an available Quest Board event.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_guild_raid_operation', {
    p_guild_id: parsed.data.guildId,
    p_event_id: parsed.data.eventId,
  });
  if (error)
    return {
      error:
        'You must be Guild leadership and the event creator or a Lodge administrator to authorize this operation.',
      success: null,
    };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Guild raid operation authorized.' };
}

const guildRaidNotesInput = z.object({ operationId: z.uuid(), notes: z.string().max(4000) });
export async function saveGuildRaidOperationNotes(_: GuildRaidOperationState, formData: FormData) {
  const parsed = guildRaidNotesInput.safeParse({
    operationId: formData.get('operationId'),
    notes: formData.get('notes'),
  });
  if (!parsed.success)
    return { error: 'Operational notes must be 4,000 characters or fewer.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_guild_raid_operation_notes', {
    p_operation_id: parsed.data.operationId,
    p_notes: parsed.data.notes,
  });
  if (error) return { error: 'Operational notes could not be saved.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Operational notes saved.' };
}

const guildRaidMemberInput = z.object({
  operationId: z.uuid(),
  memberId: z.uuid(),
  status: z.enum(['selected', 'bench']),
  role: z.enum(['tank', 'healer', 'dps']),
});
export async function saveGuildRaidOperationMember(_: GuildRaidOperationState, formData: FormData) {
  const parsed = guildRaidMemberInput.safeParse({
    operationId: formData.get('operationId'),
    memberId: formData.get('memberId'),
    status: formData.get('status'),
    role: formData.get('role'),
  });
  if (!parsed.success)
    return { error: 'Choose a valid Guild member, roster state, and role.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_guild_raid_operation_member', {
    p_operation_id: parsed.data.operationId,
    p_guild_member_id: parsed.data.memberId,
    p_planning_status: parsed.data.status,
    p_raid_role: parsed.data.role,
  });
  if (error) return { error: 'Raid planning could not be saved.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Raid roster saved.' };
}

const guildRaidAssignmentInput = z.object({
  operationId: z.uuid(),
  title: z.string().trim().min(1).max(160),
  details: z.string().max(2000),
  memberId: z.uuid().or(z.literal('')),
});
export async function createGuildRaidAssignment(_: GuildRaidOperationState, formData: FormData) {
  const parsed = guildRaidAssignmentInput.safeParse({
    operationId: formData.get('operationId'),
    title: formData.get('title'),
    details: formData.get('details') ?? '',
    memberId: formData.get('memberId') ?? '',
  });
  if (!parsed.success)
    return { error: 'Enter an assignment title of 160 characters or fewer.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_guild_raid_assignment', {
    p_operation_id: parsed.data.operationId,
    p_title: parsed.data.title,
    p_details: parsed.data.details,
    p_assigned_guild_member_id: parsed.data.memberId || null,
  });
  if (error) return { error: 'Assignment could not be saved.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Assignment added.' };
}

export async function updateGuildCharacterSharing(
  _: GuildSharingState,
  formData: FormData,
): Promise<GuildSharingState> {
  const parsed = z
    .object({
      guildId: z.uuid(),
      characterId: z.uuid(),
      visibility: z.enum(['off', 'leadership', 'members']),
    })
    .safeParse({
      guildId: formData.get('guildId'),
      characterId: formData.get('characterId'),
      visibility: formData.get('visibility'),
    });
  if (!parsed.success) return { error: 'Choose a valid sharing setting.', success: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in required.', success: null };
  const { data: character } = await supabase
    .from('characters')
    .select('id')
    .eq('id', parsed.data.characterId)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!character) return { error: 'You can only share your own Traveler.', success: null };
  const result =
    parsed.data.visibility === 'off'
      ? await supabase
          .from('character_guild_sharing')
          .delete()
          .eq('character_id', parsed.data.characterId)
          .eq('guild_id', parsed.data.guildId)
      : await supabase.from('character_guild_sharing').upsert({
          character_id: parsed.data.characterId,
          guild_id: parsed.data.guildId,
          visibility: parsed.data.visibility,
        });
  if (result.error) return { error: 'Guild sharing could not be updated.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Guild sharing updated.' };
}

export async function leaveGuild(
  _: GuildDepartureState,
  formData: FormData,
): Promise<GuildDepartureState> {
  const guildId = z.uuid().safeParse(formData.get('guildId'));
  if (!guildId.success) return { error: 'That Guild is unavailable.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_guild', { p_guild_id: guildId.data });
  if (error) return { error: 'Transfer Guild Master ownership before leaving.', success: null };
  revalidatePath('/guild-hall');
  redirect('/guild-hall');
}

export async function removeGuildMember(
  _: GuildDepartureState,
  formData: FormData,
): Promise<GuildDepartureState> {
  const memberId = z.uuid().safeParse(formData.get('membershipId'));
  if (!memberId.success) return { error: 'That Guild member is unavailable.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_guild_member', { p_guild_member_id: memberId.data });
  if (error) return { error: 'Only the Guild Master can remove this member.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Guild member removed and Guild sharing revoked.' };
}

const ownershipTransferInput = z.object({ transferId: z.uuid() });

export async function requestGuildOwnershipTransfer(
  _: GuildOwnershipTransferState,
  formData: FormData,
): Promise<GuildOwnershipTransferState> {
  const memberId = z.uuid().safeParse(formData.get('toMemberId'));
  if (!memberId.success) return { error: 'Choose another Guild member.', success: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in required.', success: null };
  const { error } = await supabase.rpc('request_guild_ownership_transfer', {
    p_to_member_id: memberId.data,
  });
  if (error) return { error: 'The ownership transfer could not be started.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Transfer requested. The recipient must explicitly accept it.' };
}

export async function acceptGuildOwnershipTransfer(
  _: GuildOwnershipTransferState,
  formData: FormData,
): Promise<GuildOwnershipTransferState> {
  const parsed = ownershipTransferInput.safeParse({ transferId: formData.get('transferId') });
  if (!parsed.success) return { error: 'That ownership transfer is unavailable.', success: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in required.', success: null };
  const { error } = await supabase.rpc('accept_guild_ownership_transfer', {
    p_transfer_id: parsed.data.transferId,
  });
  if (error) return { error: 'That ownership transfer is unavailable.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Guild Master ownership accepted.' };
}

export async function cancelGuildOwnershipTransfer(
  _: GuildOwnershipTransferState,
  formData: FormData,
): Promise<GuildOwnershipTransferState> {
  const parsed = ownershipTransferInput.safeParse({ transferId: formData.get('transferId') });
  if (!parsed.success) return { error: 'That ownership transfer is unavailable.', success: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in required.', success: null };
  const { error } = await supabase.rpc('cancel_guild_ownership_transfer', {
    p_transfer_id: parsed.data.transferId,
  });
  if (error) return { error: 'The ownership transfer could not be canceled.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Ownership transfer canceled.' };
}

const guildMemberRoleInput = z.object({
  membershipId: z.uuid(),
  role: z.enum(['officer', 'raid_leader', 'loot_council']),
  enabled: z.enum(['true', 'false']),
});

export async function updateGuildMemberRole(
  _: GuildMemberRoleState,
  formData: FormData,
): Promise<GuildMemberRoleState> {
  const parsed = guildMemberRoleInput.safeParse({
    membershipId: formData.get('membershipId'),
    role: formData.get('role'),
    enabled: formData.get('enabled'),
  });
  if (!parsed.success) return { error: 'Choose a valid Guild role.', success: null };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Sign in required.', success: null };
    const { error } = await supabase.rpc('set_guild_member_role', {
      p_guild_member_id: parsed.data.membershipId,
      p_role: parsed.data.role,
      p_enabled: parsed.data.enabled === 'true',
    });
    if (error)
      return { error: 'You do not have permission to change that Guild role.', success: null };
    revalidatePath('/guild-hall');
    return { error: null, success: 'Guild role saved.' };
  } catch {
    return { error: 'The Guild role could not be saved. Please try again.', success: null };
  }
}

export async function saveGuildRankLabel(
  _: GuildMemberPortalState,
  formData: FormData,
): Promise<GuildMemberPortalState> {
  const guildId = z.uuid().safeParse(formData.get('guildId'));
  const rank = z.coerce.number().int().min(0).safeParse(formData.get('rank'));
  const label = z.string().trim().min(1).max(80).safeParse(formData.get('label'));
  if (!guildId.success || !rank.success || !label.success)
    return { error: 'Enter a valid rank label.', success: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in required.', success: null };
  const { error } = await supabase.from('guild_rank_labels').upsert({
    guild_id: guildId.data,
    rank_index: rank.data,
    label: label.data,
    updated_by: user.id,
  });
  if (error) return { error: 'Only the Guild Master can save rank labels.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Rank label saved.' };
}

const inputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(1_000),
});

export async function createGuild(
  _: GuildCreationState,
  formData: FormData,
): Promise<GuildCreationState> {
  const parsed = inputSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
  });
  if (!parsed.success) return { error: 'Enter a Guild name of 60 characters or fewer.' };

  let guildId: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { error: 'Please sign in before creating a Guild.' };
    const { data, error } = await supabase.rpc('create_guild', {
      p_name: parsed.data.name,
      p_description: parsed.data.description || null,
    });
    const guild = z.object({ id: z.uuid() }).safeParse(data);
    if (error || !guild.success)
      return { error: 'The Guild could not be created. Please try again.' };
    guildId = guild.data.id;
  } catch {
    return { error: 'The Guild could not be created. Please try again.' };
  }
  redirect(`/guild-hall?guild=${guildId}`);
}

const rosterImportInput = z.object({
  guildId: z.uuid(),
  region: z.enum(['us', 'eu', 'kr', 'tw']),
  realm: z.string().trim().min(1).max(80),
  guildName: z.string().trim().min(1).max(80),
});
export async function importOfficialGuildRoster(
  _: GuildRosterImportState,
  formData: FormData,
): Promise<GuildRosterImportState> {
  const parsed = rosterImportInput.safeParse({
    guildId: formData.get('guildId'),
    region: formData.get('region'),
    realm: formData.get('realm'),
    guildName: formData.get('guildName'),
  });
  if (!parsed.success) return { error: 'Check the Guild identity.', success: null };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Please sign in before importing a roster.', success: null };
    const { data: membership } = await supabase
      .from('guild_members')
      .select('guild_member_roles(role)')
      .eq('guild_id', parsed.data.guildId)
      .eq('profile_id', user.id)
      .maybeSingle();
    const roles = z
      .array(z.object({ role: z.enum(['guild_master', 'officer', 'raid_leader', 'loot_council']) }))
      .safeParse(membership?.guild_member_roles);
    if (
      !roles.success ||
      !roles.data.some((r) => r.role === 'guild_master' || r.role === 'officer')
    )
      return { error: 'Only a Guild Master or Officer can import a roster.', success: null };
    const result = await fetchGuildRoster(parsed.data);
    if (!result.ok) return { error: result.message, success: null };
    const admin = createAdminClient();
    const { error: deleteError } = await admin
      .from('guild_roster_entries')
      .delete()
      .eq('guild_id', parsed.data.guildId);
    if (deleteError) throw new Error('Unable to replace roster');
    const rows = result.roster.members.map((member) => ({
      guild_id: parsed.data.guildId,
      blizzard_character_id: member.character.id,
      character_name: member.character.name,
      realm_slug: member.character.realm.slug,
      class_name: member.character.playable_class?.name ?? null,
      rank_index: member.rank,
      source_refreshed_at: result.fetchedAt,
    }));
    if (rows.length) {
      const { error } = await admin.from('guild_roster_entries').insert(rows);
      if (error) throw new Error('Unable to save roster');
    }
    const { error: snapshotError } = await admin.from('guild_blizzard_roster_snapshots').upsert({
      guild_id: parsed.data.guildId,
      region: result.region,
      realm_slug: parsed.data.realm,
      guild_name: parsed.data.guildName,
      source_url: result.sourceUrl,
      refreshed_at: result.fetchedAt,
      failure_message: null,
    });
    if (snapshotError) throw new Error('Unable to save snapshot');
    revalidatePath('/guild-hall');
    return { error: null, success: `Imported ${rows.length} official roster entries.` };
  } catch {
    return { error: 'The official roster could not be imported. Please try again.', success: null };
  }
}

const invitationInput = z.object({
  guildId: z.uuid(),
  email: z.string().trim().max(320).email().or(z.literal('')),
});
export async function createGuildInvitation(
  _: GuildInvitationState,
  formData: FormData,
): Promise<GuildInvitationState> {
  const parsed = invitationInput.safeParse({
    guildId: formData.get('guildId'),
    email: formData.get('email') ?? '',
  });
  if (!parsed.success)
    return { error: 'Enter a valid email address or leave it blank.', success: null };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return { error: 'Please sign in before creating an invitation.', success: null };
    const token = createInvitationToken();
    const { error } = await supabase.rpc('create_guild_invitation', {
      p_guild_id: parsed.data.guildId,
      p_email: parsed.data.email,
      p_token_hash: hashInvitationToken(token),
      p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) return { error: 'The Guild invitation could not be created.', success: null };
    return {
      error: null,
      success: 'Invitation created. It expires in seven days.',
      invitationPath: `/guild-invitations/${token}`,
    };
  } catch {
    return { error: 'The Guild invitation could not be created.', success: null };
  }
}

const memberPortalInput = z.object({
  guildId: z.uuid(),
  enabled: z.enum(['true', 'false']),
});

export async function updateGuildMemberPortal(
  _: GuildMemberPortalState,
  formData: FormData,
): Promise<GuildMemberPortalState> {
  const parsed = memberPortalInput.safeParse({
    guildId: formData.get('guildId'),
    enabled: formData.get('enabled'),
  });
  if (!parsed.success) return { error: 'Choose a valid Guild setting.', success: null };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return { error: 'Please sign in before changing Guild settings.', success: null };
    const { data: membership, error: membershipError } = await supabase
      .from('guild_members')
      .select('guild_member_roles(role)')
      .eq('guild_id', parsed.data.guildId)
      .eq('profile_id', user.id)
      .maybeSingle();
    const roles = z
      .array(z.object({ role: z.enum(['guild_master', 'officer', 'raid_leader', 'loot_council']) }))
      .safeParse(membership?.guild_member_roles);
    if (
      membershipError ||
      !roles.success ||
      !roles.data.some((entry) => entry.role === 'guild_master' || entry.role === 'officer')
    )
      return { error: 'Only a Guild Master or Officer can change this setting.', success: null };
    const { error } = await supabase.rpc('set_guild_member_portal', {
      p_guild_id: parsed.data.guildId,
      p_enabled: parsed.data.enabled === 'true',
    });
    if (error)
      return { error: 'The Guild setting could not be saved. Please try again.', success: null };
    return {
      error: null,
      success:
        parsed.data.enabled === 'true'
          ? 'Member portal enabled.'
          : 'Leadership-only access enabled.',
    };
  } catch {
    return { error: 'The Guild setting could not be saved. Please try again.', success: null };
  }
}
