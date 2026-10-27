import 'server-only';
import { z } from 'zod';
import { getViewer } from '@/lib/hearth/context';
import { weeklyReportSchema, weeklyRequirementSchema } from '@/lib/weekly-raider-progress';

export const reportColumns =
  'id, character_id, reset_on, mythic_run_levels, weekly_raid_bosses, raid_vault_slots, dungeon_vault_slots, world_vault_slots, reported_at';
const characterSchema = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  character_name: z.string(),
  realm_slug: z.string(),
  region: z.string(),
  class: z.string().nullable(),
  character_snapshots: z.array(
    z.object({ source: z.string(), last_refreshed_at: z.string(), snapshot_data: z.unknown() }),
  ),
});

export async function loadWeeklyRequirement(
  guildId: string,
  operationId: string | null,
  region: string,
  resetOn: string,
) {
  const { supabase } = await getViewer();
  const result = await supabase
    .from('guild_weekly_requirements')
    .select('id, mythic_runs_required, minimum_key_level, raid_bosses_required, updated_at')
    .eq('guild_id', guildId)
    .eq('scope_key', operationId ?? 'guild')
    .eq('region', region)
    .eq('reset_on', resetOn)
    .maybeSingle();
  const parsed = weeklyRequirementSchema.nullable().safeParse(result.data);
  return result.error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, requirement: parsed.data };
}

// Called only after the page verifies leadership. Cookie-client RLS remains a
// second boundary. Consent is scoped to this Guild before reports are loaded.
export async function loadSharedWeeklyProgress(guildId: string, region: string, resetOn: string) {
  const { supabase } = await getViewer();
  const [characters, shared] = await Promise.all([
    supabase
      .from('characters')
      .select(
        'id, profile_id, character_name, realm_slug, region, class, character_guild_sharing!inner(guild_id), character_snapshots(source, last_refreshed_at, snapshot_data), games!inner(slug)',
      )
      .eq('character_guild_sharing.guild_id', guildId)
      .eq('games.slug', 'wow')
      .eq('region', region)
      .order('character_name')
      .limit(1001),
    supabase
      .from('guild_vault_sharing')
      .select(`vault_progress_id, weekly_vault_progress!inner(${reportColumns})`)
      .eq('guild_id', guildId)
      .eq('weekly_vault_progress.reset_on', resetOn)
      .limit(1001),
  ]);
  const parsedCharacters = z.array(characterSchema).max(1000).safeParse(characters.data);
  const parsedShared = z
    .array(z.object({ weekly_vault_progress: weeklyReportSchema }))
    .max(1000)
    .safeParse(shared.data);
  if (characters.error || shared.error || !parsedCharacters.success || !parsedShared.success)
    return null;
  return {
    characters: parsedCharacters.data,
    reports: parsedShared.data.map((row) => row.weekly_vault_progress),
  };
}

export async function loadOwnWeeklyProgress(guildId: string, region: string, resetOn: string) {
  const { supabase, user } = await getViewer();
  const characters = await supabase
    .from('characters')
    .select('id, character_name, realm_slug, character_guild_sharing(guild_id), games!inner(slug)')
    .eq('profile_id', user.id)
    .eq('region', region)
    .eq('games.slug', 'wow')
    .order('character_name')
    .limit(101);
  const parsed = z
    .array(
      z.object({
        id: z.uuid(),
        character_name: z.string(),
        realm_slug: z.string(),
        character_guild_sharing: z.array(z.object({ guild_id: z.uuid() })),
      }),
    )
    .max(100)
    .safeParse(characters.data);
  if (characters.error || !parsed.success) return null;
  if (!parsed.data.length)
    return {
      characters: [],
      reports: [],
      sharedIds: [] as string[],
      sharedElsewhereIds: [] as string[],
    };
  const [reports, sharing] = await Promise.all([
    supabase
      .from('weekly_vault_progress')
      .select(reportColumns)
      .eq('profile_id', user.id)
      .eq('reset_on', resetOn)
      .in(
        'character_id',
        parsed.data.map((row) => row.id),
      )
      .limit(101),
    supabase
      .from('guild_vault_sharing')
      .select('vault_progress_id, guild_id')
      .eq('profile_id', user.id)
      .limit(1001),
  ]);
  const parsedReports = z.array(weeklyReportSchema).max(100).safeParse(reports.data);
  const parsedSharing = z
    .array(z.object({ vault_progress_id: z.uuid(), guild_id: z.uuid() }))
    .max(1000)
    .safeParse(sharing.data);
  if (reports.error || sharing.error || !parsedReports.success || !parsedSharing.success)
    return null;
  return {
    characters: parsed.data,
    reports: parsedReports.data,
    sharedIds: parsedSharing.data
      .filter((row) => row.guild_id === guildId)
      .map((row) => row.vault_progress_id),
    sharedElsewhereIds: parsedSharing.data
      .filter((row) => row.guild_id !== guildId)
      .map((row) => row.vault_progress_id),
  };
}
