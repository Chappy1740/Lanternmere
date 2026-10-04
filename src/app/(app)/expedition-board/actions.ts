'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type ExpeditionState = { message: string; error: boolean };

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

const postInput = z.object({
  guildId: z.uuid(),
  dungeon: z.string().trim().min(1).max(120),
  keyMin: z.coerce.number().int().min(2).max(40),
  keyMax: z.coerce.number().int().min(2).max(40),
  startsAt: z.iso.datetime({ offset: true }),
  tankSlots: z.coerce.number().int().min(0).max(1),
  healerSlots: z.coerce.number().int().min(0).max(1),
  damageSlots: z.coerce.number().int().min(0).max(3),
  note: z.string().trim().max(500),
});

export async function createExpeditionPost(
  _previous: ExpeditionState,
  formData: FormData,
): Promise<ExpeditionState> {
  const parsed = postInput.safeParse(Object.fromEntries(formData));
  if (
    !parsed.success ||
    parsed.data.keyMax < parsed.data.keyMin ||
    parsed.data.tankSlots + parsed.data.healerSlots + parsed.data.damageSlots < 1 ||
    parsed.data.tankSlots + parsed.data.healerSlots + parsed.data.damageSlots > 5
  ) {
    return { message: 'Check the dungeon, key range, start time, and roles.', error: true };
  }
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to post a Guild group.', error: true };
  const { error } = await supabase.rpc('create_guild_mythic_post', {
    p_guild_id: parsed.data.guildId,
    p_dungeon: parsed.data.dungeon,
    p_key_min: parsed.data.keyMin,
    p_key_max: parsed.data.keyMax,
    p_starts_at: parsed.data.startsAt,
    p_tank_slots: parsed.data.tankSlots,
    p_healer_slots: parsed.data.healerSlots,
    p_damage_slots: parsed.data.damageSlots,
    p_note: parsed.data.note,
  });
  if (error)
    return {
      message: 'Group post could not be created. Check Guild access and time.',
      error: true,
    };
  revalidatePath('/expedition-board');
  return {
    message: 'Group plan posted. Members choose whether to express interest.',
    error: false,
  };
}

const statusInput = z.object({ id: z.uuid(), status: z.enum(['open', 'closed']) });
export async function setExpeditionPostStatus(
  _previous: ExpeditionState,
  formData: FormData,
): Promise<ExpeditionState> {
  const parsed = statusInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Choose a valid post action.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to update the post.', error: true };
  const { error } = await supabase.rpc('set_guild_mythic_post_status', {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
  });
  if (error) return { message: 'Post could not be updated with your Guild role.', error: true };
  revalidatePath('/expedition-board');
  return { message: 'Group post updated.', error: false };
}

export async function deleteExpeditionPost(
  _previous: ExpeditionState,
  formData: FormData,
): Promise<ExpeditionState> {
  const parsed = z.uuid().safeParse(formData.get('id'));
  if (!parsed.success) return { message: 'Group post not found.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to remove the post.', error: true };
  const { error } = await supabase.rpc('delete_guild_mythic_post', { p_id: parsed.data });
  if (error) return { message: 'Post could not be removed with your Guild role.', error: true };
  revalidatePath('/expedition-board');
  return { message: 'Group post and its interests removed.', error: false };
}

const interestInput = z.object({
  postId: z.uuid(),
  characterId: z.uuid(),
  role: z.enum(['tank', 'healer', 'damage']),
  shareScore: z.enum(['true', 'false']),
});
export async function setExpeditionInterest(
  _previous: ExpeditionState,
  formData: FormData,
): Promise<ExpeditionState> {
  const parsed = interestInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Choose your Traveler and role.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to express interest.', error: true };
  const { error } = await supabase.rpc('set_guild_mythic_interest', {
    p_post_id: parsed.data.postId,
    p_character_id: parsed.data.characterId,
    p_role: parsed.data.role,
    p_share_score: parsed.data.shareScore === 'true',
  });
  if (error)
    return {
      message: 'Interest could not be saved. Check Guild and Traveler access.',
      error: true,
    };
  revalidatePath('/expedition-board');
  return {
    message: 'Interest shared with this Guild. The organizer still chooses the party.',
    error: false,
  };
}

export async function removeExpeditionInterest(
  _previous: ExpeditionState,
  formData: FormData,
): Promise<ExpeditionState> {
  const parsed = z.uuid().safeParse(formData.get('postId'));
  if (!parsed.success) return { message: 'Group post not found.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to remove your interest.', error: true };
  const { error } = await supabase.rpc('remove_guild_mythic_interest', { p_post_id: parsed.data });
  if (error) return { message: 'Interest could not be removed.', error: true };
  revalidatePath('/expedition-board');
  return { message: 'Your interest was removed.', error: false };
}

export async function clearExpeditionInterestScore(
  _previous: ExpeditionState,
  formData: FormData,
): Promise<ExpeditionState> {
  const parsed = z.uuid().safeParse(formData.get('postId'));
  if (!parsed.success) return { message: 'Group post not found.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to clear your score.', error: true };
  const { error } = await supabase.rpc('clear_guild_mythic_interest_score', {
    p_post_id: parsed.data,
  });
  if (error) return { message: 'Shared score could not be cleared.', error: true };
  revalidatePath('/expedition-board');
  return { message: 'Your shared score was cleared. Your interest remains.', error: false };
}

const goalInput = z.object({
  guildId: z.uuid(),
  resetOn: z.iso.date(),
  targetRuns: z.coerce.number().int().min(1).max(100),
  targetKeyLevel: z.coerce.number().int().min(2).max(40),
  completedRuns: z.coerce.number().int().min(0).max(100),
  note: z.string().trim().max(300),
  shared: z.enum(['true', 'false']),
});
export async function saveExpeditionGoal(
  _previous: ExpeditionState,
  formData: FormData,
): Promise<ExpeditionState> {
  const parsed = goalInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the weekly goal and progress.', error: true };
  const supabase = await authenticatedClient();
  if (!supabase) return { message: 'Sign in to save your goal.', error: true };
  const { error } = await supabase.rpc('save_guild_mythic_goal', {
    p_guild_id: parsed.data.guildId,
    p_reset_on: parsed.data.resetOn,
    p_target_runs: parsed.data.targetRuns,
    p_target_key_level: parsed.data.targetKeyLevel,
    p_completed_runs: parsed.data.completedRuns,
    p_note: parsed.data.note,
    p_shared: parsed.data.shared === 'true',
  });
  if (error)
    return {
      message: 'Weekly goal could not be saved. Check Guild access and reset date.',
      error: true,
    };
  revalidatePath('/expedition-board');
  return { message: 'Weekly goal saved. Sharing follows your choice.', error: false };
}
