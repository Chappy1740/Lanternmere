import 'server-only';

import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';

const snapshotSchema = z.object({
  character_id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  mythic_plus_score: z.number().nullable(),
  source_url: z.string().url(),
  refreshed_at: z.string(),
  failure_message: z.string().nullable(),
});

const sharingSchema = z.object({ character_id: z.uuid() });

export type RaiderIoReadiness = z.infer<typeof snapshotSchema>;

export function isRaiderIoSnapshotFresh(refreshedAt: string) {
  return Date.now() - new Date(refreshedAt).getTime() < 24 * 60 * 60 * 1000;
}

export async function loadRaiderIoReadiness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lodgeId: string,
) {
  try {
    const { data: sharingData, error: sharingError } = await supabase
      .from('character_raiderio_sharing')
      .select('character_id')
      .eq('lodge_id', lodgeId)
      .limit(12);
    const sharing = z.array(sharingSchema).safeParse(sharingData);
    if (sharingError || !sharing.success) return { state: 'error' as const };
    if (sharing.data.length === 0) return { state: 'ready' as const, snapshots: [] };

    const { data: snapshotData, error: snapshotError } = await supabase
      .from('character_raiderio_snapshots')
      .select(
        'character_id, character_name, realm_slug, region, mythic_plus_score, source_url, refreshed_at, failure_message',
      )
      .in(
        'character_id',
        sharing.data.map((row) => row.character_id),
      )
      .order('refreshed_at', { ascending: false })
      .limit(12);
    const snapshots = z.array(snapshotSchema).safeParse(snapshotData);
    if (snapshotError || !snapshots.success) return { state: 'error' as const };
    return {
      state: 'ready' as const,
      snapshots: snapshots.data,
    };
  } catch {
    return { state: 'error' as const };
  }
}

const raidbotsSchema = z.object({ character_name: z.string(), realm_slug: z.string(), region: z.string(), report_url: z.string().url(), upgrade_targets: z.string().nullable(), updated_at: z.string() });
export async function loadRaidbotsReadiness(supabase: Awaited<ReturnType<typeof createClient>>, lodgeId: string) {
  try {
    const { data, error } = await supabase.from('character_raidbots_reports')
      .select('character_name, realm_slug, region, report_url, upgrade_targets, updated_at')
      .eq('lodge_id', lodgeId).order('updated_at', { ascending: false }).limit(6);
    const parsed = z.array(raidbotsSchema).safeParse(data);
    return error || !parsed.success ? { state: 'error' as const } : { state: 'ready' as const, reports: parsed.data };
  } catch { return { state: 'error' as const }; }
}
