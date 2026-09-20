'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type QuestBoardState = { error: string | null; success: string | null };

const eventInputSchema = z.object({
  lodgeId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  activityType: z.string().trim().max(80),
  eventDate: z.iso.date(),
  eventTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .or(z.literal('')),
  difficulty: z.string().trim().max(80),
  notes: z.string().trim().max(2_000),
});
const eventIdSchema = z.uuid();
const rsvpSchema = z.object({
  eventId: z.uuid(),
  status: z.enum(['confirmed', 'tentative', 'declined']),
  role: z.enum(['', 'tank', 'healer', 'damage', 'support', 'flexible']),
  characterId: z.union([z.literal(''), z.uuid()]),
});

function eventInput(formData: FormData) {
  return eventInputSchema.safeParse({
    lodgeId: formData.get('lodgeId'),
    title: formData.get('title'),
    activityType: formData.get('activityType'),
    eventDate: formData.get('eventDate'),
    eventTime: formData.get('eventTime'),
    difficulty: formData.get('difficulty'),
    notes: formData.get('notes'),
  });
}

async function authenticatedClient() {
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

function refreshEventViews() {
  revalidatePath('/quest-board');
  revalidatePath('/quest-board/[id]', 'page');
  revalidatePath('/hearth');
}

export async function createEvent(
  _previousState: QuestBoardState,
  formData: FormData,
): Promise<QuestBoardState> {
  const parsed = eventInput(formData);
  if (!parsed.success) return { error: 'Check the event details and try again.', success: null };
  let destination = '';
  try {
    const session = await authenticatedClient();
    if (!session) return { error: 'Please sign in before creating an event.', success: null };
    const { lodgeId, title, activityType, eventDate, eventTime, difficulty, notes } = parsed.data;
    const { data, error } = await session.supabase
      .from('events')
      .insert({
        lodge_id: lodgeId,
        created_by: session.user.id,
        title,
        activity_type: activityType || null,
        event_date: eventDate,
        event_time: eventTime || null,
        difficulty: difficulty || null,
        notes: notes || null,
      })
      .select('id')
      .single();
    if (error || !data)
      return {
        error: 'The event could not be created. Check your Lodge access and try again.',
        success: null,
      };
    refreshEventViews();
    destination = `/quest-board/${data.id}?lodge=${lodgeId}`;
  } catch {
    return { error: 'The event could not be created. Please try again.', success: null };
  }
  redirect(destination);
}

export async function updateEvent(
  _previousState: QuestBoardState,
  formData: FormData,
): Promise<QuestBoardState> {
  const parsed = eventInput(formData);
  const eventId = eventIdSchema.safeParse(formData.get('eventId'));
  if (!parsed.success || !eventId.success)
    return { error: 'Check the event details and try again.', success: null };
  try {
    const session = await authenticatedClient();
    if (!session) return { error: 'Please sign in before editing an event.', success: null };
    const { data: event, error: readError } = await session.supabase
      .from('events')
      .select('id, lodge_id, created_by')
      .eq('id', eventId.data)
      .maybeSingle();
    const permitted =
      event &&
      (event.created_by === session.user.id ||
        (await isLodgeAdmin(session.supabase, event.lodge_id, session.user.id)));
    if (readError || !permitted || event.lodge_id !== parsed.data.lodgeId)
      return { error: 'You do not have permission to edit this event.', success: null };
    const { title, activityType, eventDate, eventTime, difficulty, notes } = parsed.data;
    const { error } = await session.supabase
      .from('events')
      .update({
        title,
        activity_type: activityType || null,
        event_date: eventDate,
        event_time: eventTime || null,
        difficulty: difficulty || null,
        notes: notes || null,
      })
      .eq('id', event.id);
    if (error) return { error: 'The event could not be updated. Please try again.', success: null };
    refreshEventViews();
    return { error: null, success: 'Event details updated.' };
  } catch {
    return { error: 'The event could not be updated. Please try again.', success: null };
  }
}

async function isLodgeAdmin(
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
  return !error && (data?.role === 'owner' || data?.role === 'caretaker');
}

export async function deleteEvent(
  _previousState: QuestBoardState,
  formData: FormData,
): Promise<QuestBoardState> {
  const parsed = eventIdSchema.safeParse(formData.get('eventId'));
  if (!parsed.success) return { error: 'Choose a valid event.', success: null };
  try {
    const session = await authenticatedClient();
    if (!session) return { error: 'Please sign in before removing an event.', success: null };
    const { data: event, error: readError } = await session.supabase
      .from('events')
      .select('id, lodge_id, created_by')
      .eq('id', parsed.data)
      .maybeSingle();
    const permitted =
      event &&
      (event.created_by === session.user.id ||
        (await isLodgeAdmin(session.supabase, event.lodge_id, session.user.id)));
    if (readError || !permitted)
      return { error: 'You do not have permission to remove this event.', success: null };
    const { error } = await session.supabase.from('events').delete().eq('id', event.id);
    if (error) return { error: 'The event could not be removed. Please try again.', success: null };
    refreshEventViews();
    return { error: null, success: 'Event removed from the Quest Board.' };
  } catch {
    return { error: 'The event could not be removed. Please try again.', success: null };
  }
}

export async function updateRsvp(
  _previousState: QuestBoardState,
  formData: FormData,
): Promise<QuestBoardState> {
  const parsed = rsvpSchema.safeParse({
    eventId: formData.get('eventId'),
    status: formData.get('status'),
    role: formData.get('role') ?? '',
    characterId: formData.get('characterId') ?? '',
  });
  if (!parsed.success) return { error: 'Choose a valid RSVP status.', success: null };
  try {
    const session = await authenticatedClient();
    if (!session) return { error: 'Please sign in before saving an RSVP.', success: null };
    const { data: event, error: eventError } = await session.supabase
      .from('events')
      .select('id')
      .eq('id', parsed.data.eventId)
      .maybeSingle();
    if (eventError || !event)
      return { error: 'This event is not available to your Lodge.', success: null };
    if (parsed.data.characterId) {
      const { data: character, error: characterError } = await session.supabase
        .from('characters')
        .select('id')
        .eq('id', parsed.data.characterId)
        .eq('profile_id', session.user.id)
        .maybeSingle();
      if (characterError || !character)
        return {
          error: 'Choose one of your own Travelers, or leave it unassigned.',
          success: null,
        };
    }
    const { error } = await session.supabase.from('event_attendees').upsert(
      {
        event_id: event.id,
        profile_id: session.user.id,
        rsvp_status: parsed.data.status,
        character_id: parsed.data.characterId || null,
        role: parsed.data.role || null,
      },
      { onConflict: 'event_id,profile_id' },
    );
    if (error) return { error: 'Your RSVP could not be saved. Please try again.', success: null };
    refreshEventViews();
    return { error: null, success: 'Your RSVP has been saved.' };
  } catch {
    return { error: 'Your RSVP could not be saved. Please try again.', success: null };
  }
}
