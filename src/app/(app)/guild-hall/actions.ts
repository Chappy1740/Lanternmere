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
export type GuildIdentityState = { error: string | null; success: string | null };
export async function updateGuildIdentity(_: GuildIdentityState, formData: FormData) {
  const parsed = z
    .object({
      guildId: z.uuid(),
      name: z.string().trim().min(1).max(60),
      description: z.string().trim().max(1000),
    })
    .safeParse({
      guildId: formData.get('guildId'),
      name: formData.get('name'),
      description: formData.get('description') ?? '',
    });
  if (!parsed.success)
    return { error: 'Enter a Guild name and description within the limits.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_guild_identity', {
    p_guild_id: parsed.data.guildId,
    p_name: parsed.data.name,
    p_description: parsed.data.description || null,
  });
  if (error)
    return { error: 'Only a Guild Master or Officer can update Guild identity.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Guild identity updated.' };
}
export type GuildRaidOperationState = { error: string | null; success: string | null };
export type GuildRaidEncounterState = { error: string | null; success: string | null };
export type GuildRaidLootState = { error: string | null; success: string | null };

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
const guildRaidMemberCharacterInput = z.object({
  operationId: z.uuid(),
  memberId: z.uuid(),
  characterId: z.uuid(),
});
export async function saveGuildRaidOperationMemberCharacter(
  _: GuildRaidOperationState,
  formData: FormData,
) {
  const parsed = guildRaidMemberCharacterInput.safeParse({
    operationId: formData.get('operationId'),
    memberId: formData.get('memberId'),
    characterId: formData.get('characterId'),
  });
  if (!parsed.success) return { error: 'Choose a consented Traveler.', success: null };
  const { error } = await (
    await createClient()
  ).rpc('set_guild_raid_operation_member_character', {
    p_operation_id: parsed.data.operationId,
    p_guild_member_id: parsed.data.memberId,
    p_character_id: parsed.data.characterId,
  });
  if (error)
    return { error: 'That Traveler is not available for this Guild member.', success: null };
  revalidatePath('/guild-hall');
  revalidatePath('/guild-hall/raid-room');
  return { error: null, success: 'Raid context selected.' };
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

const guildRaidAttendanceInput = z.object({
  operationId: z.uuid(),
  memberId: z.uuid(),
  status: z.enum(['invited', 'confirmed', 'attended', 'late', 'absent', 'benched']),
  note: z.string().max(1000),
});
export async function saveGuildRaidAttendance(_: GuildRaidOperationState, formData: FormData) {
  const parsed = guildRaidAttendanceInput.safeParse({
    operationId: formData.get('operationId'),
    memberId: formData.get('memberId'),
    status: formData.get('status'),
    note: formData.get('note') ?? '',
  });
  if (!parsed.success)
    return { error: 'Choose a valid attendance status and optional note.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_guild_raid_attendance', {
    p_operation_id: parsed.data.operationId,
    p_guild_member_id: parsed.data.memberId,
    p_attendance_status: parsed.data.status,
    p_context_note: parsed.data.note,
  });
  if (error) return { error: 'Attendance could not be saved.', success: null };
  revalidatePath('/guild-hall');
  return { error: null, success: 'Attendance recorded.' };
}

const guildRaidEncounterInput = z.object({
  operationId: z.uuid(),
  title: z.string().trim().min(1).max(160),
  encounterOrder: z.coerce.number().int().min(0).max(1000),
  strategy: z.string().max(6000),
});
export async function createGuildRaidEncounter(_: GuildRaidEncounterState, formData: FormData) {
  const parsed = guildRaidEncounterInput.safeParse({
    operationId: formData.get('operationId'),
    title: formData.get('title'),
    encounterOrder: formData.get('encounterOrder') ?? 0,
    strategy: formData.get('strategy') ?? '',
  });
  if (!parsed.success)
    return {
      error: 'Enter an encounter title, order, and strategy within the limits.',
      success: null,
    };
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_guild_raid_encounter', {
    p_operation_id: parsed.data.operationId,
    p_title: parsed.data.title,
    p_encounter_order: parsed.data.encounterOrder,
    p_strategy: parsed.data.strategy,
  });
  if (error) return { error: 'Encounter workspace could not be created.', success: null };
  revalidatePath('/guild-hall/raid-room');
  return { error: null, success: 'Encounter workspace created.' };
}

const guildRaidEncounterStrategyInput = z.object({
  encounterId: z.uuid(),
  strategy: z.string().max(6000),
});
export async function saveGuildRaidEncounterStrategy(
  _: GuildRaidEncounterState,
  formData: FormData,
) {
  const parsed = guildRaidEncounterStrategyInput.safeParse({
    encounterId: formData.get('encounterId'),
    strategy: formData.get('strategy'),
  });
  if (!parsed.success)
    return { error: 'Strategy must be 6,000 characters or fewer.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_guild_raid_encounter_strategy', {
    p_encounter_id: parsed.data.encounterId,
    p_strategy: parsed.data.strategy,
  });
  if (error) return { error: 'Encounter strategy could not be saved.', success: null };
  revalidatePath('/guild-hall/raid-room');
  return { error: null, success: 'Encounter strategy saved.' };
}

const guildRaidEncounterDirectiveInput = z.object({
  encounterId: z.uuid(),
  type: z.enum(['assignment', 'interrupt', 'cooldown', 'marker', 'note']),
  title: z.string().trim().min(1).max(160),
  details: z.string().max(2000),
  memberId: z.uuid().or(z.literal('')),
  directiveOrder: z.coerce.number().int().min(0).max(1000),
});
export async function createGuildRaidEncounterDirective(
  _: GuildRaidEncounterState,
  formData: FormData,
) {
  const parsed = guildRaidEncounterDirectiveInput.safeParse({
    encounterId: formData.get('encounterId'),
    type: formData.get('type'),
    title: formData.get('title'),
    details: formData.get('details') ?? '',
    memberId: formData.get('memberId') ?? '',
    directiveOrder: formData.get('directiveOrder') ?? 0,
  });
  if (!parsed.success) return { error: 'Enter a valid encounter callout.', success: null };
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_guild_raid_encounter_directive', {
    p_encounter_id: parsed.data.encounterId,
    p_directive_type: parsed.data.type,
    p_title: parsed.data.title,
    p_details: parsed.data.details,
    p_assigned_guild_member_id: parsed.data.memberId || null,
    p_directive_order: parsed.data.directiveOrder,
  });
  if (error) return { error: 'Encounter callout could not be saved.', success: null };
  revalidatePath('/guild-hall/raid-room');
  return { error: null, success: 'Encounter callout added.' };
}

const lootDropInput = z.object({
  operationId: z.uuid(),
  itemName: z.string().trim().min(1).max(160),
  itemLevel: z.coerce.number().int().min(1).max(1000).or(z.literal('')),
  slot: z.string().max(80),
  sourceNote: z.string().max(1000),
});
export async function createGuildRaidLootDrop(_: GuildRaidLootState, formData: FormData) {
  const parsed = lootDropInput.safeParse({
    operationId: formData.get('operationId'),
    itemName: formData.get('itemName'),
    itemLevel: formData.get('itemLevel') ?? '',
    slot: formData.get('slot') ?? '',
    sourceNote: formData.get('sourceNote') ?? '',
  });
  if (!parsed.success) return { error: 'Enter a valid loot drop.', success: null };
  const { error } = await (
    await createClient()
  ).rpc('create_guild_raid_loot_drop', {
    p_operation_id: parsed.data.operationId,
    p_item_name: parsed.data.itemName,
    p_item_level: parsed.data.itemLevel === '' ? null : parsed.data.itemLevel,
    p_equipment_slot: parsed.data.slot,
    p_source_note: parsed.data.sourceNote,
  });
  if (error) return { error: 'Loot drop could not be recorded.', success: null };
  revalidatePath('/guild-hall/raid-room');
  return { error: null, success: 'Loot drop recorded.' };
}
const lootCandidateInput = z.object({
  dropId: z.uuid(),
  memberId: z.uuid(),
  interest: z.enum(['need', 'offspec', 'pass']),
  context: z.string().max(1000),
});
export async function saveGuildRaidLootCandidate(_: GuildRaidLootState, formData: FormData) {
  const parsed = lootCandidateInput.safeParse({
    dropId: formData.get('dropId'),
    memberId: formData.get('memberId'),
    interest: formData.get('interest'),
    context: formData.get('context') ?? '',
  });
  if (!parsed.success) return { error: 'Enter a valid candidate and interest.', success: null };
  const { error } = await (
    await createClient()
  ).rpc('set_guild_raid_loot_candidate', {
    p_loot_drop_id: parsed.data.dropId,
    p_guild_member_id: parsed.data.memberId,
    p_interest: parsed.data.interest,
    p_factual_context: parsed.data.context,
  });
  if (error) return { error: 'Candidate could not be saved.', success: null };
  revalidatePath('/guild-hall/raid-room');
  return { error: null, success: 'Candidate saved.' };
}
const lootVoteInput = z.object({
  dropId: z.uuid(),
  candidateId: z.uuid(),
  rationale: z.string().max(1000),
});
export async function castGuildRaidLootVote(_: GuildRaidLootState, formData: FormData) {
  const parsed = lootVoteInput.safeParse({
    dropId: formData.get('dropId'),
    candidateId: formData.get('candidateId'),
    rationale: formData.get('rationale') ?? '',
  });
  if (!parsed.success) return { error: 'Choose a valid candidate.', success: null };
  const { error } = await (
    await createClient()
  ).rpc('cast_guild_raid_loot_vote', {
    p_loot_drop_id: parsed.data.dropId,
    p_candidate_id: parsed.data.candidateId,
    p_rationale: parsed.data.rationale,
  });
  if (error) return { error: 'Vote could not be saved.', success: null };
  revalidatePath('/guild-hall/raid-room');
  return { error: null, success: 'Vote saved.' };
}
const lootAwardInput = z.object({
  dropId: z.uuid(),
  candidateId: z.uuid(),
  reason: z.string().trim().min(1).max(1000),
});
export async function awardGuildRaidLoot(_: GuildRaidLootState, formData: FormData) {
  const parsed = lootAwardInput.safeParse({
    dropId: formData.get('dropId'),
    candidateId: formData.get('candidateId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success)
    return { error: 'Choose a candidate and provide an award reason.', success: null };
  const { error } = await (
    await createClient()
  ).rpc('award_guild_raid_loot', {
    p_loot_drop_id: parsed.data.dropId,
    p_candidate_id: parsed.data.candidateId,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: 'Award could not be recorded.', success: null };
  revalidatePath('/guild-hall/raid-room');
  return { error: null, success: 'Award recorded.' };
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
    if (!result.ok) {
      const { data: recorded, error: failureError } = await supabase.rpc(
        'record_guild_roster_refresh_failure',
        { p_guild_id: parsed.data.guildId, p_failure_message: result.message },
      );
      if (!failureError && recorded) revalidatePath('/guild-hall');
      return {
        error: recorded
          ? `${result.message} The last successful roster remains available.`
          : result.message,
        success: null,
      };
    }
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
