import 'server-only';

import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const timestamp = z.iso.datetime({ offset: true });
const achievementSchema = z.object({
  id: z.uuid(),
  lodge_id: z.uuid(),
  character_id: z.uuid().nullable(),
  created_by: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  achieved_at: timestamp.nullable(),
  source: z.string().nullable(),
  created_at: timestamp,
  profiles: z.object({ display_name: z.string().nullable() }).nullable(),
  characters: z
    .object({ character_name: z.string(), realm_slug: z.string(), class: z.string().nullable() })
    .nullable(),
});

export type Achievement = z.infer<typeof achievementSchema>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

const achievementFields =
  'id, lodge_id, character_id, created_by, title, description, achieved_at, source, created_at, profiles(display_name), characters(character_name, realm_slug, class)';

export async function loadAchievements(supabase: Supabase, lodgeId: string, query = '') {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select(achievementFields)
      .eq('lodge_id', lodgeId)
      .order('achieved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100);
    const parsed = z.array(achievementSchema).safeParse(data);
    if (error || !parsed.success) return null;
    const needle = query.trim().toLocaleLowerCase();
    return needle
      ? parsed.data.filter((entry) =>
          `${entry.title}\n${entry.description ?? ''}\n${entry.characters?.character_name ?? ''}`
            .toLocaleLowerCase()
            .includes(needle),
        )
      : parsed.data;
  } catch {
    return null;
  }
}

export async function loadAchievement(supabase: Supabase, achievementId: string, lodgeId: string) {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select(achievementFields)
      .eq('id', achievementId)
      .eq('lodge_id', lodgeId)
      .maybeSingle();
    const parsed = achievementSchema.safeParse(data);
    return error || !parsed.success ? null : parsed.data;
  } catch {
    return null;
  }
}

export function achievementDate(value: string | null, fallback: string) {
  const date = new Date(value ?? fallback);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function achievementCredit(entry: Achievement) {
  if (entry.characters) {
    return `${entry.characters.character_name} · ${entry.characters.realm_slug}`;
  }
  return 'Lodge milestone';
}
