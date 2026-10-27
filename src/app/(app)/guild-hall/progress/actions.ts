'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getGuildMemberships, isGuildLeadership } from '@/lib/guilds';
import { weeklyResetForRegion } from '@/lib/war-table';
import { parseRunLevels } from '@/lib/weekly-raider-progress';

export type ProgressState = { message: string; error: boolean };
const optionalCount = (maximum: number) =>
  z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    z.coerce.number().int().min(0).max(maximum).nullable(),
  );
const targetInput = z.object({
  guildId: z.uuid(),
  operationId: z.union([z.uuid(), z.literal('')]),
  region: z.enum(['us', 'eu']),
  resetOn: z.iso.date(),
  runs: z.coerce.number().int().min(1).max(50),
  minimumKey: z.coerce.number().int().min(2).max(40),
  raidBosses: optionalCount(1000),
});

export async function saveWeeklyRequirement(
  _previous: ProgressState,
  form: FormData,
): Promise<ProgressState> {
  const parsed = targetInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: true, message: 'Check the weekly target.' };
  const input = parsed.data;
  const reset = weeklyResetForRegion(input.region);
  if (reset?.isoDate !== input.resetOn)
    return { error: true, message: 'The week changed. Reload before saving.' };
  const memberships = await getGuildMemberships();
  const membership = memberships.find((entry) => entry.guild_id === input.guildId);
  if (
    !membership?.verified ||
    !isGuildLeadership(membership.guild_member_roles.map(({ role }) => role))
  )
    return { error: true, message: 'Verified Guild leadership is required.' };
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: true, message: 'Sign in to save the target.' };
  const { error } = await supabase.rpc('save_guild_weekly_requirement', {
    p_guild_id: input.guildId,
    p_operation_id: input.operationId || null,
    p_region: input.region,
    p_reset_on: reset.isoDate,
    p_mythic_runs_required: input.runs,
    p_minimum_key_level: input.minimumKey,
    p_raid_bosses_required: input.raidBosses,
  });
  if (error)
    return {
      error: true,
      message: 'The target could not be saved. Check your Guild access and try again.',
    };
  revalidatePath('/guild-hall/progress');
  return { error: false, message: 'Target saved for this roster and reset week.' };
}

// Database error codes raised by save_weekly_raider_report; anything else stays generic.
function reportErrorMessage(code: string | undefined, sharing: boolean) {
  if (code === '22023') return 'The week changed. Reload the page and try again.';
  if (code === '23514') return 'Check your weekly counts and Vault slots.';
  if (code === '42501')
    return sharing
      ? 'Progress could not be saved. To share, first share this Traveler with this Guild in the Guild Hall.'
      : 'Progress could not be saved. Check that you still own this Traveler and belong to this Guild.';
  return 'Progress could not be saved. Try again.';
}

const reportInput = z.object({
  guildId: z.uuid(),
  characterId: z.uuid(),
  resetOn: z.iso.date(),
  runLevels: z.string().max(400),
  bosses: optionalCount(1000),
  raidSlots: optionalCount(3),
  dungeonSlots: optionalCount(3),
  worldSlots: optionalCount(3),
  shared: z.enum(['true', 'false']),
});
export async function saveWeeklyReport(
  _previous: ProgressState,
  form: FormData,
): Promise<ProgressState> {
  const parsed = reportInput.safeParse({
    ...Object.fromEntries(form),
    shared: form.has('shared') ? 'true' : 'false',
  });
  if (!parsed.success) return { error: true, message: 'Check your weekly counts and Vault slots.' };
  const input = parsed.data;
  const levels = parseRunLevels(input.runLevels);
  if (levels === undefined)
    return {
      error: true,
      message: 'Enter run levels from 2 to 40, separated by commas; enter none for zero runs.',
    };
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: true, message: 'Sign in to update your progress.' };
  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('id, region, games!inner(slug)')
    .eq('id', input.characterId)
    .eq('profile_id', user.id)
    .eq('games.slug', 'wow')
    .maybeSingle();
  const reset = character && !characterError ? weeklyResetForRegion(character.region) : null;
  if (!character || !reset || reset.isoDate !== input.resetOn)
    return { error: true, message: 'Check your Traveler and reload the current week.' };
  const { error } = await supabase.rpc('save_weekly_raider_report', {
    p_character_id: character.id,
    p_guild_id: input.guildId,
    p_reset_on: reset.isoDate,
    p_mythic_run_levels: levels,
    p_weekly_raid_bosses: input.bosses,
    p_raid_vault_slots: input.raidSlots,
    p_dungeon_vault_slots: input.dungeonSlots,
    p_world_vault_slots: input.worldSlots,
    p_shared: input.shared === 'true',
  });
  if (error)
    return { error: true, message: reportErrorMessage(error.code, input.shared === 'true') };
  revalidatePath('/guild-hall/progress');
  revalidatePath('/war-table');
  return {
    error: false,
    message:
      input.shared === 'true'
        ? 'Progress saved and shared with this Guild’s leadership.'
        : 'Progress saved; sharing with this Guild is off.',
  };
}
