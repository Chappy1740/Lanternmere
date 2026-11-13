import { z } from 'zod';

const count = z.number().int().min(0).max(1000).nullable();
const slots = z.number().int().min(0).max(3).nullable();
export const weeklyReportSchema = z.object({
  id: z.uuid(),
  character_id: z.uuid(),
  reset_on: z.iso.date(),
  mythic_run_levels: z.array(z.number().int().min(2).max(40)).max(100).nullable(),
  weekly_raid_bosses: count,
  raid_vault_slots: slots,
  dungeon_vault_slots: slots,
  world_vault_slots: slots,
  reported_at: z.iso.datetime({ offset: true }).nullable(),
});
export type WeeklyReport = z.infer<typeof weeklyReportSchema>;
export const weeklyRequirementSchema = z.object({
  id: z.uuid(),
  mythic_runs_required: z.number().int().min(1).max(50),
  minimum_key_level: z.number().int().min(2).max(40),
  raid_bosses_required: count,
  updated_at: z.string(),
});
export type WeeklyRequirement = z.infer<typeof weeklyRequirementSchema>;

export type ProgressCharacter = {
  id: string;
  profile_id: string;
  character_name: string;
  realm_slug: string;
  region: string;
  class: string | null;
  character_snapshots: { source: string; last_refreshed_at: string; snapshot_data: unknown }[];
};
export type ProgressMember = { id: string; profile_id: string; name: string };
export type ProgressSelection = {
  guild_member_id: string;
  character_id: string | null;
  planning_status: 'selected' | 'bench';
  raid_role: string;
};
export type ProgressRow = {
  id: string;
  member: string;
  character: string | null;
  realm: string | null;
  className: string | null;
  role: string | null;
  bench: boolean;
  itemLevel: number | null;
  completed: number | null;
  remaining: number | null;
  bosses: number | null;
  observedBosses: { raid: string; difficulty: string; boss: string }[];
  observedRuns: { level: number; dungeon: string; completedAt: string }[];
  vault: { raid: number | null; dungeon: number | null; world: number | null };
  reportedAt: string | null;
  snapshotAt: string | null;
  snapshotStale: boolean;
  status: 'met' | 'remaining' | 'unknown' | 'stale' | 'no_target';
  equipment: {
    slot: string;
    name: string;
    itemLevel: number | null;
    enchants: string[];
    sockets: string[];
  }[];
};

// Blank is unknown. "none" explicitly records zero, including an empty run list.
export function parseRunLevels(value: string): number[] | null | undefined {
  const text = value.trim();
  if (!text) return null;
  if (text.toLowerCase() === 'none') return [];
  const pieces = text.split(/[\s,]+/);
  if (pieces.length > 100 || pieces.some((piece) => !/^\d+$/.test(piece))) return undefined;
  const parsed = z.array(z.number().int().min(2).max(40)).safeParse(pieces.map(Number));
  return parsed.success ? parsed.data : undefined;
}

const snapshotSchema = z.object({
  equipped_item_level: z.number().nonnegative().optional(),
  equipment: z
    .array(
      z.object({
        slot: z.string(),
        name: z.string(),
        item_level: z.number().nullable(),
        enchantments: z.array(z.string()),
        sockets: z.array(z.string()),
      }),
    )
    .max(40)
    .optional()
    .catch(undefined),
  raid_encounters: z
    .array(
      z.object({
        raid: z.string(),
        difficulty: z.string(),
        boss: z.string(),
        last_kill_at: z.string().nullable(),
      }),
    )
    .max(200)
    .optional()
    .catch(undefined),
  weekly_mythic_runs: z
    .array(
      z.object({
        level: z.number().int().min(2).max(40),
        dungeon: z.string(),
        completedAt: z.string(),
      }),
    )
    .max(100)
    .optional()
    .catch(undefined),
});

export function buildProgressRows(input: {
  members: ProgressMember[];
  characters: ProgressCharacter[];
  reports: WeeklyReport[];
  requirement: WeeklyRequirement | null;
  selection: ProgressSelection[] | null;
  region: string;
  resetOn: string;
  weekStartsAt: string;
  weekEndsAt: string;
  now?: number;
}): ProgressRow[] {
  const now = input.now ?? Date.now();
  const start = Date.parse(input.weekStartsAt);
  const end = Date.parse(input.weekEndsAt);
  const inWeek = (value: string) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp >= start && timestamp < end && timestamp <= now;
  };
  const reports = new Map(
    input.reports
      .filter((report) => report.reset_on === input.resetOn)
      .map((report) => [report.character_id, report]),
  );
  return input.members.flatMap((member) => {
    const selected = input.selection?.find((entry) => entry.guild_member_id === member.id);
    if (input.selection && !selected) return [];
    const characters = input.characters.filter(
      (character) =>
        character.profile_id === member.profile_id &&
        character.region === input.region &&
        (!input.selection || character.id === selected?.character_id),
    );
    return (characters.length ? characters : [null]).map((character): ProgressRow => {
      const snapshot = character?.character_snapshots
        .filter(
          (entry) =>
            entry.source === 'blizzard' &&
            Number.isFinite(Date.parse(entry.last_refreshed_at)) &&
            Date.parse(entry.last_refreshed_at) <= now,
        )
        .sort((a, b) => Date.parse(b.last_refreshed_at) - Date.parse(a.last_refreshed_at))[0];
      const details = snapshotSchema.safeParse(snapshot?.snapshot_data);
      const data = details.success ? details.data : null;
      const rawReport = character ? reports.get(character.id) : null;
      const report = rawReport?.reported_at && inWeek(rawReport.reported_at) ? rawReport : null;
      const target = input.requirement;
      const completed =
        report?.mythic_run_levels === null || !report
          ? null
          : report.mythic_run_levels.filter((level) => level >= (target?.minimum_key_level ?? 2))
              .length;
      const bosses = report?.weekly_raid_bosses ?? null;
      const stale =
        !!report?.reported_at && now - Date.parse(report.reported_at) >= 24 * 60 * 60 * 1000;
      const needsBosses = (target?.raid_bosses_required ?? 0) > 0;
      const missing = completed === null || (needsBosses && bosses === null);
      const met =
        target &&
        completed !== null &&
        completed >= target.mythic_runs_required &&
        (!needsBosses || (bosses !== null && bosses >= (target.raid_bosses_required ?? 0)));
      const observedBosses = [
        ...new Map(
          (data?.raid_encounters ?? [])
            .filter((entry) => entry.last_kill_at && inWeek(entry.last_kill_at))
            .map(({ raid, difficulty, boss }) => [
              `${raid}\0${difficulty}\0${boss}`,
              { raid, difficulty, boss },
            ]),
        ).values(),
      ];
      return {
        id: `${member.id}:${character?.id ?? 'unknown'}`,
        member: member.name,
        character: character?.character_name ?? null,
        realm: character?.realm_slug ?? null,
        className: character?.class ?? null,
        role: selected?.raid_role ?? null,
        bench: selected?.planning_status === 'bench',
        itemLevel: data?.equipped_item_level ?? null,
        completed,
        remaining:
          completed !== null && target
            ? Math.max(0, target.mythic_runs_required - completed)
            : null,
        bosses,
        observedBosses,
        observedRuns: (data?.weekly_mythic_runs ?? []).filter((run) => inWeek(run.completedAt)),
        vault: {
          raid: report?.raid_vault_slots ?? null,
          dungeon: report?.dungeon_vault_slots ?? null,
          world: report?.world_vault_slots ?? null,
        },
        reportedAt: report?.reported_at ?? null,
        snapshotAt: snapshot?.last_refreshed_at ?? null,
        snapshotStale:
          !snapshot || now - Date.parse(snapshot.last_refreshed_at) >= 24 * 60 * 60 * 1000,
        status: !target
          ? 'no_target'
          : missing
            ? 'unknown'
            : stale
              ? 'stale'
              : met
                ? 'met'
                : 'remaining',
        equipment: (data?.equipment ?? []).map((item) => ({
          slot: item.slot,
          name: item.name,
          itemLevel: item.item_level,
          enchants: item.enchantments,
          sockets: item.sockets,
        })),
      };
    });
  });
}
