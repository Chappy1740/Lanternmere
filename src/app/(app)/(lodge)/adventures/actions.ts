'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type EventTemplateState = { error: string | null; success: string | null };

const inputSchema = z.object({
  lodgeId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  activityType: z.string().trim().max(80),
  weekday: z.coerce.number().int().min(0).max(6),
  eventTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .or(z.literal('')),
  difficulty: z.string().trim().max(80),
  notes: z.string().trim().max(2_000),
});

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

function refresh() {
  revalidatePath('/adventures');
  revalidatePath('/quest-board/new');
}

export async function createEventTemplate(
  _previousState: EventTemplateState,
  formData: FormData,
): Promise<EventTemplateState> {
  const parsed = inputSchema.safeParse({
    lodgeId: formData.get('lodgeId'),
    title: formData.get('title'),
    activityType: formData.get('activityType') ?? '',
    weekday: formData.get('weekday'),
    eventTime: formData.get('eventTime') ?? '',
    difficulty: formData.get('difficulty') ?? '',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) return { error: 'Check the recurring plan and try again.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before saving a recurring plan.', success: null };
  const { error } = await current.supabase.from('event_templates').insert({
    lodge_id: parsed.data.lodgeId,
    created_by: current.user.id,
    title: parsed.data.title,
    activity_type: parsed.data.activityType || null,
    weekday: parsed.data.weekday,
    event_time: parsed.data.eventTime || null,
    difficulty: parsed.data.difficulty || null,
    notes: parsed.data.notes || null,
  });
  if (error)
    return {
      error: 'The recurring plan could not be saved. Check your Lodge access and try again.',
      success: null,
    };
  refresh();
  return { error: null, success: 'Recurring plan saved.' };
}

export async function deleteEventTemplate(
  _previousState: EventTemplateState,
  formData: FormData,
): Promise<EventTemplateState> {
  const templateId = z.uuid().safeParse(formData.get('templateId'));
  if (!templateId.success) return { error: 'Choose a valid recurring plan.', success: null };
  const current = await session();
  if (!current) return { error: 'Please sign in before removing a recurring plan.', success: null };
  const { error } = await current.supabase
    .from('event_templates')
    .delete()
    .eq('id', templateId.data);
  if (error)
    return {
      error: 'The recurring plan could not be removed. Please check your access.',
      success: null,
    };
  refresh();
  return { error: null, success: 'Recurring plan removed.' };
}
