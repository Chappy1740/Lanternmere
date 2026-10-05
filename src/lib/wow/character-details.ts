import { z } from 'zod';

const name = z.string().trim().min(1).max(160);
const equipmentItem = z.object({
  name,
  slot: z.object({ name }).optional(),
  level: z.object({ value: z.number().int().nonnegative() }).optional(),
  quality: z.object({ name }).optional(),
  enchantments: z
    .array(z.object({ display_string: name }))
    .max(8)
    .optional(),
  sockets: z
    .array(z.object({ display_string: name.optional() }))
    .max(8)
    .optional(),
});
const equipmentResponse = z.object({
  character: z.object({ id: z.number().int().positive() }),
  equipped_items: z.array(equipmentItem).max(40),
});

export type EquipmentItem = {
  name: string;
  slot: string;
  item_level: number | null;
  quality: string | null;
  enchantments: string[];
  sockets: string[];
};

export function parseCharacterEquipment(
  value: unknown,
  characterId: number,
): EquipmentItem[] | null {
  const parsed = equipmentResponse.safeParse(value);
  if (!parsed.success || parsed.data.character.id !== characterId) return null;
  return parsed.data.equipped_items.map((item) => ({
    name: item.name,
    slot: item.slot?.name ?? 'Other',
    item_level: item.level?.value ?? null,
    quality: item.quality?.name ?? null,
    enchantments: (item.enchantments ?? []).map((entry) => entry.display_string),
    sockets: (item.sockets ?? []).flatMap((entry) =>
      entry.display_string ? [entry.display_string] : [],
    ),
  }));
}

const raidResponse = z.object({
  character: z.object({ id: z.number().int().positive() }),
  expansions: z
    .array(
      z.object({
        instances: z
          .array(
            z.object({
              instance: z.object({ name }),
              modes: z
                .array(
                  z.object({
                    difficulty: z.object({ name }),
                    progress: z.object({
                      encounters: z
                        .array(
                          z.object({
                            encounter: z.object({ name }),
                            completed_count: z.number().int().nonnegative(),
                            last_kill_timestamp: z.number().int().nonnegative().optional(),
                          }),
                        )
                        .max(100),
                    }),
                  }),
                )
                .max(12),
            }),
          )
          .max(100),
      }),
    )
    .max(30),
});

export type RaidEncounter = {
  raid: string;
  difficulty: string;
  boss: string;
  kills: number;
  last_kill_at: string | null;
};

export type RaidMilestone = {
  achievement_id: number;
  name: string;
  kind: 'AOTC' | 'CE';
  completed_at: string;
};

const achievementResponse = z.object({
  character: z.object({ id: z.number().int().positive() }),
  achievements: z
    .array(
      z.object({
        achievement: z.object({ id: z.number().int().positive(), name }),
        completed_timestamp: z.number().int().positive().optional(),
      }),
    )
    .max(10000),
});

export function parseCharacterRaidMilestones(
  value: unknown,
  characterId: number,
): RaidMilestone[] | null {
  const parsed = achievementResponse.safeParse(value);
  if (!parsed.success || parsed.data.character.id !== characterId) return null;
  const milestones = new Map<number, RaidMilestone>();
  for (const entry of parsed.data.achievements) {
    const kind = entry.achievement.name.startsWith('Ahead of the Curve:')
      ? 'AOTC'
      : entry.achievement.name.startsWith('Cutting Edge:')
        ? 'CE'
        : null;
    if (!kind || !entry.completed_timestamp) continue;
    const completed = new Date(entry.completed_timestamp);
    if (!Number.isFinite(completed.getTime())) continue;
    const milestone: RaidMilestone = {
      achievement_id: entry.achievement.id,
      name: entry.achievement.name,
      kind,
      completed_at: completed.toISOString(),
    };
    const previous = milestones.get(milestone.achievement_id);
    if (!previous || milestone.completed_at < previous.completed_at)
      milestones.set(milestone.achievement_id, milestone);
  }
  return [...milestones.values()]
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
    .slice(0, 100);
}

export function parseCharacterRaidEncounters(
  value: unknown,
  characterId: number,
): RaidEncounter[] | null {
  const parsed = raidResponse.safeParse(value);
  if (!parsed.success || parsed.data.character.id !== characterId) return null;
  return parsed.data.expansions
    .flatMap((expansion) =>
      expansion.instances.flatMap((instance) =>
        instance.modes.flatMap((mode) =>
          mode.progress.encounters.map((entry) => ({
            raid: instance.instance.name,
            difficulty: mode.difficulty.name,
            boss: entry.encounter.name,
            kills: entry.completed_count,
            last_kill_at:
              entry.last_kill_timestamp &&
              Number.isFinite(new Date(entry.last_kill_timestamp).getTime())
                ? new Date(entry.last_kill_timestamp).toISOString()
                : null,
          })),
        ),
      ),
    )
    .sort((a, b) => (b.last_kill_at ?? '').localeCompare(a.last_kill_at ?? ''))
    .slice(0, 200);
}
