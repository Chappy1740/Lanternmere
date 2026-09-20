import 'server-only';

import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const chronicleSchema = z.object({
  id: z.uuid(),
  lodge_id: z.uuid(),
  author_id: z.uuid(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  image_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  profiles: z.object({ display_name: z.string().nullable() }).nullable(),
});

export type Chronicle = z.infer<typeof chronicleSchema>;
const chronicleMediaSchema = z.object({
  id: z.uuid(),
  chronicle_id: z.uuid(),
  lodge_id: z.uuid(),
  uploaded_by: z.uuid(),
  storage_path: z.string().min(1),
  caption: z.string().nullable(),
  created_at: z.string(),
});
export type ChronicleMedia = z.infer<typeof chronicleMediaSchema> & { url: string | null };
type Supabase = Awaited<ReturnType<typeof createClient>>;

const chronicleFields =
  'id, lodge_id, author_id, title, body, image_url, created_at, updated_at, profiles(display_name)';

function parseRows(data: unknown) {
  const parsed = z.array(chronicleSchema).safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function loadChronicles(
  supabase: Supabase,
  lodgeId: string,
  query = '',
  range?: { from?: string; to?: string },
) {
  try {
    let request = supabase
      .from('chronicle_entries')
      .select(chronicleFields)
      .eq('lodge_id', lodgeId);
    if (range?.from) request = request.gte('created_at', `${range.from}T00:00:00.000Z`);
    if (range?.to) request = request.lte('created_at', `${range.to}T23:59:59.999Z`);
    const { data, error } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100);
    const rows = !error ? parseRows(data) : null;
    if (!rows) return null;
    const needle = query.trim().toLocaleLowerCase();
    return needle
      ? rows.filter((entry) =>
          `${entry.title ?? ''}\n${entry.body ?? ''}`.toLocaleLowerCase().includes(needle),
        )
      : rows;
  } catch {
    return null;
  }
}

export async function loadChronicle(supabase: Supabase, chronicleId: string, lodgeId: string) {
  try {
    const { data, error } = await supabase
      .from('chronicle_entries')
      .select(chronicleFields)
      .eq('id', chronicleId)
      .eq('lodge_id', lodgeId)
      .maybeSingle();
    const parsed = !error ? chronicleSchema.safeParse(data) : { success: false as const };
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function loadChronicleMedia(supabase: Supabase, chronicleId: string, lodgeId: string) {
  try {
    const { data, error } = await supabase
      .from('chronicle_media')
      .select('id, chronicle_id, lodge_id, uploaded_by, storage_path, caption, created_at')
      .eq('chronicle_id', chronicleId)
      .eq('lodge_id', lodgeId)
      .order('created_at')
      .limit(12);
    const parsed = z.array(chronicleMediaSchema).safeParse(data);
    if (error || !parsed.success) return null;
    return Promise.all(
      parsed.data.map(async (media) => {
        const { data: signed, error: signedError } = await supabase.storage
          .from('chronicle-media')
          .createSignedUrl(media.storage_path, 60 * 60);
        return { ...media, url: signedError ? null : (signed?.signedUrl ?? null) };
      }),
    );
  } catch {
    return null;
  }
}

export function chronicleDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function chronicleExcerpt(body: string | null, limit = 240) {
  const normalized = body?.trim().replace(/\s+/g, ' ') ?? '';
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}
