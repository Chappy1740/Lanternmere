'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type AchievementState = { error: string | null; success: string | null };
const inputSchema = z.object({
  lodgeId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000),
  achievedAt: z.string().trim().max(40),
  characterId: z.union([z.literal(''), z.uuid()]),
});

function input(formData: FormData) {
  return inputSchema.safeParse({
    lodgeId: formData.get('lodgeId'),
    title: formData.get('title'),
    description: formData.get('description') ?? '',
    achievedAt: formData.get('achievedAt') ?? '',
    characterId: formData.get('characterId') ?? '',
  });
}

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

async function roleFor(
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
  return error ? null : (data?.role ?? null);
}

async function ownsCharacter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  characterId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('characters')
    .select('id')
    .eq('id', characterId)
    .eq('profile_id', userId)
    .maybeSingle();
  return !error && Boolean(data);
}

function refresh() {
  revalidatePath('/hall-of-legends');
  revalidatePath('/hall-of-legends/[id]', 'page');
  revalidatePath('/hearth');
}

async function permittedToManage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lodgeId: string,
  createdBy: string,
  userId: string,
) {
  const role = await roleFor(supabase, lodgeId, userId);
  return createdBy === userId || role === 'owner' || role === 'caretaker';
}

export async function createAchievement(
  _: AchievementState,
  formData: FormData,
): Promise<AchievementState> {
  const parsed = input(formData);
  if (!parsed.success)
    return { error: 'Check the achievement details and try again.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before recording an achievement.', success: null };
  const role = await roleFor(current.supabase, parsed.data.lodgeId, current.user.id);
  if (!role) return { error: 'You do not have access to this Lodge.', success: null };
  if (
    parsed.data.characterId &&
    !(await ownsCharacter(current.supabase, parsed.data.characterId, current.user.id))
  )
    return { error: 'You can only credit one of your own Travelers.', success: null };
  const achievedAt = parsed.data.achievedAt ? new Date(parsed.data.achievedAt) : null;
  if (achievedAt && Number.isNaN(achievedAt.getTime()))
    return { error: 'Choose a valid achievement date.', success: null };
  const { data, error } = await current.supabase
    .from('achievements')
    .insert({
      lodge_id: parsed.data.lodgeId,
      created_by: current.user.id,
      character_id: parsed.data.characterId || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      achieved_at: achievedAt?.toISOString() ?? null,
      source: 'manual',
    })
    .select('id')
    .single();
  if (error || !data)
    return { error: 'The achievement could not be saved. Please try again.', success: null };
  refresh();
  redirect(`/hall-of-legends/${data.id}?lodge=${parsed.data.lodgeId}`);
}

export async function updateAchievement(
  _: AchievementState,
  formData: FormData,
): Promise<AchievementState> {
  const parsed = input(formData);
  const id = z.uuid().safeParse(formData.get('achievementId'));
  if (!parsed.success || !id.success)
    return { error: 'Check the achievement details and try again.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before editing an achievement.', success: null };
  const { data: existing, error: readError } = await current.supabase
    .from('achievements')
    .select('id, lodge_id, created_by')
    .eq('id', id.data)
    .maybeSingle();
  if (
    readError ||
    !existing ||
    existing.lodge_id !== parsed.data.lodgeId ||
    !(await permittedToManage(
      current.supabase,
      existing.lodge_id,
      existing.created_by,
      current.user.id,
    ))
  )
    return { error: 'You do not have permission to edit this achievement.', success: null };
  if (
    parsed.data.characterId &&
    !(await ownsCharacter(current.supabase, parsed.data.characterId, current.user.id))
  )
    return { error: 'You can only credit one of your own Travelers.', success: null };
  const achievedAt = parsed.data.achievedAt ? new Date(parsed.data.achievedAt) : null;
  if (achievedAt && Number.isNaN(achievedAt.getTime()))
    return { error: 'Choose a valid achievement date.', success: null };
  const { error } = await current.supabase
    .from('achievements')
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      character_id: parsed.data.characterId || null,
      achieved_at: achievedAt?.toISOString() ?? null,
    })
    .eq('id', existing.id);
  if (error)
    return { error: 'The achievement could not be updated. Please try again.', success: null };
  refresh();
  return { error: null, success: 'Achievement updated.' };
}

export async function deleteAchievement(
  _: AchievementState,
  formData: FormData,
): Promise<AchievementState> {
  const id = z.uuid().safeParse(formData.get('achievementId'));
  if (!id.success) return { error: 'Choose a valid achievement.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before removing an achievement.', success: null };
  const { data: existing, error: readError } = await current.supabase
    .from('achievements')
    .select('id, lodge_id, created_by')
    .eq('id', id.data)
    .maybeSingle();
  if (
    readError ||
    !existing ||
    !(await permittedToManage(
      current.supabase,
      existing.lodge_id,
      existing.created_by,
      current.user.id,
    ))
  )
    return { error: 'You do not have permission to remove this achievement.', success: null };
  const { error } = await current.supabase.from('achievements').delete().eq('id', existing.id);
  if (error)
    return { error: 'The achievement could not be removed. Please try again.', success: null };
  refresh();
  return { error: null, success: 'Achievement removed.' };
}
