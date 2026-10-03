'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type MusterState = { message: string; error: boolean };

const role = z.enum(['tank', 'healer', 'damage', 'flex']);
const optionalLink = z.union([
  z.literal(''),
  z
    .url()
    .max(500)
    .refine((value) => new URL(value).protocol === 'https:'),
]);

const needInput = z.object({
  guildId: z.uuid(),
  id: z.union([z.uuid(), z.literal('')]),
  raidRole: role,
  className: z.string().trim().max(40),
  specName: z.string().trim().max(40),
  slots: z.coerce.number().int().min(1).max(20),
  description: z.string().trim().max(500),
  active: z.enum(['true', 'false']),
});

export async function saveRecruitmentNeed(
  _previous: MusterState,
  formData: FormData,
): Promise<MusterState> {
  const parsed = needInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the recruitment need details.', error: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: 'Sign in to manage recruitment.', error: true };
  const { error } = await supabase.rpc('save_guild_recruitment_need', {
    p_guild_id: parsed.data.guildId,
    p_id: parsed.data.id || null,
    p_raid_role: parsed.data.raidRole,
    p_class_name: parsed.data.className || null,
    p_spec_name: parsed.data.specName || null,
    p_slots: parsed.data.slots,
    p_description: parsed.data.description,
    p_active: parsed.data.active === 'true',
  });
  if (error)
    return { message: 'Recruitment need could not be saved. Check your Guild role.', error: true };
  revalidatePath('/muster');
  return { message: 'Recruitment need saved.', error: false };
}

const applicationInput = z.object({
  guildId: z.uuid(),
  characterId: z.union([z.uuid(), z.literal('')]),
  raidRole: role,
  className: z.string().trim().max(40),
  specName: z.string().trim().max(40),
  availability: z.string().trim().max(500),
  experience: z.string().trim().min(10).max(1000),
  profileUrl: optionalLink,
  logUrl: optionalLink,
});

export async function submitRecruitmentApplication(
  _previous: MusterState,
  formData: FormData,
): Promise<MusterState> {
  const parsed = applicationInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { message: 'Check your application details and secure links.', error: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: 'Sign in to apply.', error: true };
  const { error } = await supabase.rpc('submit_guild_application', {
    p_guild_id: parsed.data.guildId,
    p_character_id: parsed.data.characterId || null,
    p_raid_role: parsed.data.raidRole,
    p_class_name: parsed.data.className || null,
    p_spec_name: parsed.data.specName || null,
    p_availability: parsed.data.availability,
    p_experience: parsed.data.experience,
    p_profile_url: parsed.data.profileUrl || null,
    p_log_url: parsed.data.logUrl || null,
  });
  if (error)
    return {
      message: 'Application could not be submitted. You may already have an active application.',
      error: true,
    };
  revalidatePath('/muster');
  return { message: 'Application submitted. The Guild can now review it.', error: false };
}

const stageInput = z.object({
  id: z.uuid(),
  status: z.enum(['reviewing', 'trial', 'accepted', 'declined']),
  trialStartsOn: z.union([z.iso.date(), z.literal('')]),
  trialEndsOn: z.union([z.iso.date(), z.literal('')]),
  attendanceContext: z.string().trim().max(1000),
  decisionNote: z.string().trim().max(1000),
});

export async function setRecruitmentStage(
  _previous: MusterState,
  formData: FormData,
): Promise<MusterState> {
  const parsed = stageInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Check the trial dates and review details.', error: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: 'Sign in to review applications.', error: true };
  const { error } = await supabase.rpc('set_guild_application_stage', {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_trial_starts_on: parsed.data.trialStartsOn || null,
    p_trial_ends_on: parsed.data.trialEndsOn || null,
    p_attendance_context: parsed.data.attendanceContext,
    p_decision_note: parsed.data.decisionNote,
  });
  if (error)
    return {
      message: 'Stage could not be saved. Final decisions require an Officer or Guild Master.',
      error: true,
    };
  revalidatePath('/muster');
  return { message: 'Application stage recorded.', error: false };
}

export async function addRecruitmentNote(
  _previous: MusterState,
  formData: FormData,
): Promise<MusterState> {
  const parsed = z
    .object({ id: z.uuid(), note: z.string().trim().min(1).max(1000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: 'Write a note of 1–1,000 characters.', error: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: 'Sign in to add a note.', error: true };
  const { error } = await supabase.rpc('add_guild_application_note', {
    p_id: parsed.data.id,
    p_note: parsed.data.note,
  });
  if (error) return { message: 'Officer note could not be saved.', error: true };
  revalidatePath('/muster');
  return { message: 'Private note saved.', error: false };
}

export async function deleteRecruitmentApplication(
  _previous: MusterState,
  formData: FormData,
): Promise<MusterState> {
  const parsed = z.uuid().safeParse(formData.get('id'));
  if (!parsed.success) return { message: 'Application not found.', error: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: 'Sign in to delete an application.', error: true };
  const { error } = await supabase.rpc('delete_guild_application', { p_id: parsed.data });
  if (error) return { message: 'Application could not be deleted.', error: true };
  revalidatePath('/muster');
  return { message: 'Application and private notes deleted.', error: false };
}
