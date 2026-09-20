import 'server-only';

import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const eventSchema = z.object({
  id: z.uuid(),
  lodge_id: z.uuid(),
  created_by: z.uuid(),
  title: z.string(),
  activity_type: z.string().nullable(),
  event_date: z.iso.date(),
  event_time: z.string().nullable(),
  difficulty: z.string().nullable(),
  notes: z.string().nullable(),
});

const attendeeSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  rsvp_status: z.enum(['confirmed', 'tentative', 'declined']),
  role: z.string().nullable(),
  character_id: z.uuid().nullable(),
  characters: z.object({ character_name: z.string(), realm_slug: z.string() }).nullable(),
  profiles: z.object({ display_name: z.string().nullable() }).nullable(),
});

export type LodgeEvent = z.infer<typeof eventSchema>;
export type EventAttendee = z.infer<typeof attendeeSchema>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

function parseRows<T>(schema: z.ZodType<T>, data: unknown) {
  const parsed = z.array(schema).safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function loadQuestBoard(supabase: Supabase, lodgeId: string, today: string) {
  try {
    const [upcomingResult, pastResult] = await Promise.all([
      supabase
        .from('events')
        .select(
          'id, lodge_id, created_by, title, activity_type, event_date, event_time, difficulty, notes',
        )
        .eq('lodge_id', lodgeId)
        .gte('event_date', today)
        .order('event_date')
        .order('event_time', { nullsFirst: false })
        .order('id'),
      supabase
        .from('events')
        .select(
          'id, lodge_id, created_by, title, activity_type, event_date, event_time, difficulty, notes',
        )
        .eq('lodge_id', lodgeId)
        .lt('event_date', today)
        .order('event_date', { ascending: false })
        .order('event_time', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(12),
    ]);
    const upcoming = !upcomingResult.error ? parseRows(eventSchema, upcomingResult.data) : null;
    const past = !pastResult.error ? parseRows(eventSchema, pastResult.data) : null;
    return { upcoming, past };
  } catch {
    return { upcoming: null, past: null };
  }
}

export async function loadEventDetail(supabase: Supabase, eventId: string, lodgeId: string) {
  try {
    const [{ data: eventData, error: eventError }, attendeeResult] = await Promise.all([
      supabase
        .from('events')
        .select(
          'id, lodge_id, created_by, title, activity_type, event_date, event_time, difficulty, notes',
        )
        .eq('id', eventId)
        .eq('lodge_id', lodgeId)
        .maybeSingle(),
      supabase
        .from('event_attendees')
        .select(
          'id, profile_id, rsvp_status, role, character_id, profiles(display_name), characters(character_name, realm_slug)',
        )
        .eq('event_id', eventId)
        .order('rsvp_status')
        .order('id'),
    ]);
    const event = !eventError ? eventSchema.safeParse(eventData) : { success: false as const };
    const attendees = !attendeeResult.error ? parseRows(attendeeSchema, attendeeResult.data) : null;
    return { event: event.success ? event.data : null, attendees };
  } catch {
    return { event: null, attendees: null };
  }
}

export const eventRoles = ['tank', 'healer', 'damage', 'support', 'flexible'] as const;
export type EventRole = (typeof eventRoles)[number];

export function eventRoleLabel(role: string | null) {
  return role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}` : 'Unassigned';
}

export function groupComposition(attendees: EventAttendee[]) {
  const counts = new Map<EventRole | 'unassigned', number>();
  for (const attendee of attendees) {
    if (attendee.rsvp_status !== 'confirmed') continue;
    const role = eventRoles.includes(attendee.role as EventRole)
      ? (attendee.role as EventRole)
      : 'unassigned';
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return [...counts.entries()].map(([role, count]) => ({ role, count }));
}

export function eventDateTime(event: Pick<LodgeEvent, 'event_date' | 'event_time'>) {
  const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(`${event.event_date}T00:00:00Z`),
  );
  return event.event_time
    ? `${date} at ${event.event_time.slice(0, 5)}`
    : `${date}, time to be arranged`;
}
