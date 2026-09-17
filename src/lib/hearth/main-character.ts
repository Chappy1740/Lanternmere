import 'server-only';
import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';
import { displayProfileSchema } from '@/lib/wow/character-display';
import { loadRefreshFailures } from '@/lib/wow/refresh-status';

const mainSchema = z.object({
  id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  class: z.string().nullable(),
  faction: z.string().nullable(),
  level: z.number().nullable(),
});
const snapshotSchema = z.object({
  source: z.string(),
  last_refreshed_at: z.string(),
  snapshot_data: z.unknown(),
});

export async function loadMainCharacter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    const result = await supabase
      .from('characters')
      .select('id, character_name, realm_slug, region, class, faction, level, games!inner(slug)')
      .eq('profile_id', userId)
      .eq('is_main', true)
      .eq('games.slug', 'wow')
      .maybeSingle();
    if (result.error) return { state: 'error' as const };
    if (!result.data) return { state: 'empty' as const };
    const parsed = mainSchema.safeParse(result.data);
    if (!parsed.success) return { state: 'error' as const };
    const character = parsed.data;
    const [snapshotResult, failures] = await Promise.all([
      supabase
        .from('character_snapshots')
        .select('source, last_refreshed_at, snapshot_data')
        .eq('character_id', character.id)
        .order('last_refreshed_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(
          (value) => value,
          () => ({ data: null, error: true }),
        ),
      loadRefreshFailures(supabase, [character.id]),
    ]);
    const snapshotParsed = snapshotSchema.safeParse(snapshotResult.data);
    const snapshot = !snapshotResult.error && snapshotParsed.success ? snapshotParsed.data : null;
    const profile = displayProfileSchema.safeParse(snapshot?.snapshot_data);
    return {
      state: 'ready' as const,
      character,
      snapshot,
      profile: profile.success ? profile.data : null,
      snapshotUnavailable: Boolean(
        snapshotResult.error || (snapshotResult.data && !snapshotParsed.success),
      ),
      failedAt: failures.latest.get(character.id),
      statusUnavailable: failures.unavailable,
    };
  } catch {
    return { state: 'error' as const };
  }
}
