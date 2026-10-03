'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { loadMainCharacter } from '@/lib/hearth/main-character';
import { weeklyResetForRegion } from '@/lib/war-table';

const input = z.object({
  guildId: z.uuid(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  status: z.enum(['available', 'tentative', 'unavailable']),
  note: z.string().trim().max(500),
});

export type AvailabilityState = { message: string; error: boolean };

export async function createAvailability(_previous: AvailabilityState, formData: FormData): Promise<AvailabilityState> {
  const parsed = input.safeParse({
    guildId: formData.get('guildId'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn'),
    status: formData.get('status'),
    note: formData.get('note'),
  });
  if (!parsed.success || parsed.data.endsOn < parsed.data.startsOn)
    return { message: 'Check the dates and availability details.', error: true };
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_guild_member_availability', {
    p_guild_id: parsed.data.guildId,
    p_starts_on: parsed.data.startsOn,
    p_ends_on: parsed.data.endsOn,
    p_availability_status: parsed.data.status,
    p_note: parsed.data.note || null,
  });
  if (error) return { message: 'Availability could not be saved. Try again.', error: true };
  revalidatePath('/war-table');
  return { message: 'Availability saved.', error: false };
}

export async function deleteAvailability(_previous: AvailabilityState, formData: FormData): Promise<AvailabilityState> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return { message: 'Invalid availability period.', error: true };
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_guild_member_availability', { p_id: id.data });
  if (error) return { message: 'Availability could not be removed. Try again.', error: true };
  revalidatePath('/war-table');
  return { message: 'Availability removed.', error: false };
}

export type VaultState = { message: string; error: boolean };
const vaultInput = z.object({
  characterId: z.uuid(),
  resetOn: z.iso.date(),
  raidProgress: z.string().trim().max(160),
  dungeonProgress: z.string().trim().max(160),
  worldProgress: z.string().trim().max(160),
  notes: z.string().trim().max(500),
});

export async function saveVaultProgress(
  _previous: VaultState,
  formData: FormData,
): Promise<VaultState> {
  const parsed = vaultInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the Vault details and try again.', error: true };
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { message: 'Sign in to update your Vault context.', error: true };
  const main = await loadMainCharacter(supabase, user.id);
  const reset = main.state === 'ready' ? weeklyResetForRegion(main.character.region) : null;
  if (
    !reset ||
    main.state !== 'ready' ||
    main.character.id !== parsed.data.characterId ||
    reset.isoDate !== parsed.data.resetOn
  ) {
    return {
      message: 'Your Main character or weekly reset changed. Reload the War Table.',
      error: true,
    };
  }
  const { data: existing, error: readError } = await supabase
    .from('weekly_vault_progress')
    .select('id')
    .eq('character_id', main.character.id)
    .eq('reset_on', reset.isoDate)
    .maybeSingle();
  if (readError) return { message: 'Vault context is unavailable. Try again later.', error: true };
  const fields = {
    raid_progress: parsed.data.raidProgress,
    dungeon_progress: parsed.data.dungeonProgress,
    world_progress: parsed.data.worldProgress,
    notes: parsed.data.notes,
  };
  const result = existing
    ? await supabase.from('weekly_vault_progress').update(fields).eq('id', existing.id)
    : await supabase.from('weekly_vault_progress').insert({
        profile_id: user.id,
        character_id: main.character.id,
        reset_on: reset.isoDate,
        ...fields,
      });
  if (result.error) return { message: 'Vault context could not be saved. Try again.', error: true };
  revalidatePath('/war-table');
  return { message: 'Vault context saved for this reset week.', error: false };
}

export type CalendarState = { message: string; error: boolean };
const calendarInput = z.object({
  guildId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  category: z.enum([
    'mythic_plus',
    'alt_run',
    'achievement',
    'meeting',
    'social',
    'trial',
    'other',
  ]),
  eventDate: z.iso.date(),
  eventTime: z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
  details: z.string().trim().max(1000),
});

export async function createGuildCalendarEntry(
  _previous: CalendarState,
  formData: FormData,
): Promise<CalendarState> {
  const parsed = calendarInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the calendar details and try again.', error: true };
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_guild_calendar_entry', {
    p_guild_id: parsed.data.guildId,
    p_title: parsed.data.title,
    p_category: parsed.data.category,
    p_event_date: parsed.data.eventDate,
    p_event_time: parsed.data.eventTime || null,
    p_details: parsed.data.details,
  });
  if (error)
    return {
      message: 'The entry could not be saved. Check your Guild leadership access.',
      error: true,
    };
  revalidatePath('/war-table');
  return { message: 'Guild calendar entry saved.', error: false };
}

export async function deleteGuildCalendarEntry(formData: FormData) {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_guild_calendar_entry', { p_id: id.data });
  if (!error) revalidatePath('/war-table');
}

export type VaultShareState = { message: string; error: boolean };
export async function setGuildVaultSharing(
  _previous: VaultShareState,
  formData: FormData,
): Promise<VaultShareState> {
  const parsed = z
    .object({
      progressId: z.uuid(),
      guildId: z.uuid(),
      enabled: z.enum(['true', 'false']),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the sharing choice and try again.', error: true };
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { message: 'Sign in to change Vault sharing.', error: true };
  const { error } = await supabase.rpc('set_guild_vault_sharing', {
    p_vault_progress_id: parsed.data.progressId,
    p_guild_id: parsed.data.guildId,
    p_enabled: parsed.data.enabled === 'true',
  });
  if (error)
    return {
      message: 'Vault sharing could not be changed. Check Guild access and try again.',
      error: true,
    };
  revalidatePath('/war-table');
  return {
    message:
      parsed.data.enabled === 'true'
        ? 'Shared with selected Guild leadership.'
        : 'Guild sharing revoked.',
    error: false,
  };
}
