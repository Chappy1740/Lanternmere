import 'server-only';

import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const templateSchema = z.object({
  id: z.uuid(),
  lodge_id: z.uuid(),
  created_by: z.uuid(),
  title: z.string(),
  activity_type: z.string().nullable(),
  weekday: z.number().int().min(0).max(6),
  event_time: z.string().nullable(),
  difficulty: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
});

export type EventTemplate = z.infer<typeof templateSchema>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadEventTemplates(supabase: Supabase, lodgeId: string) {
  try {
    const { data, error } = await supabase
      .from('event_templates')
      .select(
        'id, lodge_id, created_by, title, activity_type, weekday, event_time, difficulty, notes, created_at',
      )
      .eq('lodge_id', lodgeId)
      .order('weekday')
      .order('event_time', { nullsFirst: false })
      .order('title')
      .limit(50);
    const parsed = z.array(templateSchema).safeParse(data);
    return error || !parsed.success ? null : parsed.data;
  } catch {
    return null;
  }
}

export async function loadEventTemplate(supabase: Supabase, templateId: string, lodgeId: string) {
  try {
    const { data, error } = await supabase
      .from('event_templates')
      .select(
        'id, lodge_id, created_by, title, activity_type, weekday, event_time, difficulty, notes, created_at',
      )
      .eq('id', templateId)
      .eq('lodge_id', lodgeId)
      .maybeSingle();
    const parsed = templateSchema.safeParse(data);
    return error || !parsed.success ? null : parsed.data;
  } catch {
    return null;
  }
}

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function templateSchedule(template: Pick<EventTemplate, 'weekday' | 'event_time'>) {
  const time = template.event_time ? ` at ${template.event_time.slice(0, 5)} UTC` : '';
  return `Every ${weekdays[template.weekday]}${time}`;
}
