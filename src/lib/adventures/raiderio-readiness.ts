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
const attemptSchema = z.object({
  character_id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  attempted_at: z.string(),
  failure_message: z.string().nullable(),
});

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
      .order('enabled_at', { ascending: false })
      .limit(7);
    const sharing = z.array(sharingSchema).safeParse(sharingData);
    if (sharingError || !sharing.success) return { state: 'error' as const };
    if (sharing.data.length === 0)
      return { state: 'ready' as const, snapshots: [], pending: [], hasMore: false };

    const characterIds = sharing.data.slice(0, 6).map((row) => row.character_id);

    const [
      { data: snapshotData, error: snapshotError },
      { data: attemptData, error: attemptError },
    ] = await Promise.all([
      supabase
        .from('character_raiderio_snapshots')
        .select(
          'character_id, character_name, realm_slug, region, mythic_plus_score, source_url, refreshed_at, failure_message',
        )
        .in('character_id', characterIds),
      supabase
        .from('character_raiderio_refresh_attempts')
        .select('character_id, character_name, realm_slug, region, attempted_at, failure_message')
        .in('character_id', characterIds),
    ]);
    const snapshots = z.array(snapshotSchema).safeParse(snapshotData);
    const attempts = z.array(attemptSchema).safeParse(attemptData);
    if (snapshotError || attemptError || !snapshots.success || !attempts.success)
      return { state: 'error' as const };
    const snapshotById = new Map(
      snapshots.data.map((snapshot) => [snapshot.character_id, snapshot]),
    );
    const attemptById = new Map(attempts.data.map((attempt) => [attempt.character_id, attempt]));
    return {
      state: 'ready' as const,
      snapshots: characterIds.flatMap((id) => {
        const snapshot = snapshotById.get(id);
        if (!snapshot) return [];
        const attempt = attemptById.get(id);
        return [
          {
            ...snapshot,
            failure_message:
              attempt && attempt.attempted_at > snapshot.refreshed_at
                ? attempt.failure_message
                : snapshot.failure_message,
          },
        ];
      }),
      pending: characterIds
        .filter((id) => !snapshotById.has(id))
        .map((id) => ({ character_id: id, attempt: attemptById.get(id) ?? null })),
      hasMore: sharing.data.length > 6,
    };
  } catch {
    return { state: 'error' as const };
  }
}

const raidbotsSchema = z.object({
  character_id: z.uuid(),
  lodge_id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  report_url: z.string().url(),
  upgrade_targets: z.string().nullable(),
  updated_at: z.string(),
});
export async function loadRaidbotsReadiness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lodgeId: string,
) {
  try {
    const { data, error } = await supabase
      .from('character_raidbots_reports')
      .select(
        'character_id, lodge_id, character_name, realm_slug, region, report_url, upgrade_targets, updated_at',
      )
      .eq('lodge_id', lodgeId)
      .order('updated_at', { ascending: false })
      .limit(6);
    const parsed = z.array(raidbotsSchema).safeParse(data);
    return error || !parsed.success
      ? { state: 'error' as const }
      : { state: 'ready' as const, reports: parsed.data };
  } catch {
    return { state: 'error' as const };
  }
}
