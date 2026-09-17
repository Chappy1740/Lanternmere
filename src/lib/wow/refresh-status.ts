import 'server-only';
import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

// Separate from the snapshot query so unavailable status never hides saved data.
export async function loadRefreshFailures(
  supabase: Awaited<ReturnType<typeof createClient>>,
  characterIds: string[],
) {
  const latest = new Map<string, string>();
  if (!characterIds.length) return { latest, unavailable: false };
  try {
    const { data, error } = await supabase
      .from('characters')
      .select('id, character_refresh_failures(attempted_at)')
      .in('id', characterIds)
      .order('attempted_at', { referencedTable: 'character_refresh_failures', ascending: false })
      .limit(1, { referencedTable: 'character_refresh_failures' });
    const parsed = z
      .array(
        z.object({
          id: z.uuid(),
          character_refresh_failures: z.array(
            z.object({ attempted_at: z.iso.datetime({ offset: true }) }),
          ),
        }),
      )
      .safeParse(data);
    if (error || !parsed.success) return { latest, unavailable: true };
    for (const row of parsed.data) {
      const failure = row.character_refresh_failures[0];
      if (failure) latest.set(row.id, failure.attempted_at);
    }
    return { latest, unavailable: false };
  } catch {
    return { latest, unavailable: true };
  }
}
