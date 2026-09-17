import 'server-only';
import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const timestamp = z.iso.datetime({ offset: true });
const eventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  event_date: z.iso.date(),
  event_time: z.string().nullable(),
  activity_type: z.string().nullable(),
  difficulty: z.string().nullable(),
});
const achievementSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  achieved_at: timestamp.nullable(),
  created_at: timestamp,
});
const chronicleSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  image_url: z.string().nullable(),
  created_at: timestamp,
});

async function readSection<T>(
  schema: z.ZodType<T>,
  query: () => PromiseLike<{ data: unknown; error: unknown }>,
) {
  try {
    const result = await query();
    const parsed = z.array(schema).safeParse(result.data);
    return result.error || !parsed.success
      ? { state: 'error' as const, rows: [] as T[] }
      : { state: 'ready' as const, rows: parsed.data };
  } catch {
    return { state: 'error' as const, rows: [] as T[] };
  }
}

export async function loadLodgeActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lodgeId: string,
  now = new Date(),
) {
  const [events, achievements, chronicles] = await Promise.all([
    readSection(eventSchema, () =>
      supabase
        .from('events')
        .select('id, title, event_date, event_time, activity_type, difficulty')
        .eq('lodge_id', lodgeId)
        .gte('event_date', now.toISOString().slice(0, 10))
        .order('event_date')
        .order('event_time', { nullsFirst: false })
        .order('id')
        .limit(3),
    ),
    readSection(achievementSchema, () =>
      supabase
        .from('achievements')
        .select('id, title, description, achieved_at, created_at')
        .eq('lodge_id', lodgeId)
        .order('created_at', { ascending: false })
        .order('id')
        .limit(3),
    ),
    readSection(chronicleSchema, () =>
      supabase
        .from('chronicle_entries')
        .select('id, title, body, image_url, created_at')
        .eq('lodge_id', lodgeId)
        .order('created_at', { ascending: false })
        .order('id')
        .limit(3),
    ),
  ]);
  return { events, achievements, chronicles };
}

export function activityDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value.length === 10 ? `${value}T00:00:00Z` : value),
  );
}
export function excerpt(value: string | null) {
  const text = value?.trim() || '';
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}
