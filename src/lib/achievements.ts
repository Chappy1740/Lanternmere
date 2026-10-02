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

const pageSize = 100;

export async function loadAchievements(supabase: Supabase, lodgeId: string, query = '', page = 1) {
  try {
    const offset = (Math.max(1, page) - 1) * pageSize;
    if (query.trim()) {
      const { data: matches, error: searchError } = await supabase.rpc(
        'search_lodge_achievement_ids',
        { p_lodge_id: lodgeId, p_query: query.trim(), p_limit: pageSize + 1, p_offset: offset },
      );
      const ids = z.array(z.object({ id: z.uuid() })).safeParse(matches);
      if (searchError || !ids.success) return null;
      const pageIds = ids.data.slice(0, pageSize).map((match) => match.id);
      if (pageIds.length === 0) return { entries: [], hasMore: false };
      const { data, error } = await supabase
        .from('achievements')
        .select(achievementFields)
        .eq('lodge_id', lodgeId)
        .in('id', pageIds);
      const parsed = z.array(achievementSchema).safeParse(data);
      if (error || !parsed.success) return null;
      const order = new Map(pageIds.map((id, index) => [id, index]));
      return {
        entries: parsed.data.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
        hasMore: ids.data.length > pageSize,
      };
    }
    const { data, error } = await supabase
      .from('achievements')
      .select(achievementFields)
      .eq('lodge_id', lodgeId)
      .order('achieved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize);
    const parsed = z.array(achievementSchema).safeParse(data);
    if (error || !parsed.success) return null;
    return { entries: parsed.data.slice(0, pageSize), hasMore: parsed.data.length > pageSize };
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
