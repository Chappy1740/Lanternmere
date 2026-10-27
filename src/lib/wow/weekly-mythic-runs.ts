import { z } from 'zod';

// Blizzard's best-runs list is partial. Never interpret its length as all runs,
// derive Vault rewards from it, or interpret an empty response as zero activity.
export function parseWeeklyMythicRuns(value: unknown) {
  const parsed = z
    .object({
      current_period: z.object({
        best_runs: z
          .array(
            z.object({
              completed_timestamp: z.number().int().positive(),
              keystone_level: z.number().int().min(2).max(40),
              dungeon: z.object({
                id: z.number().int().positive(),
                name: z.string().min(1).max(160),
              }),
            }),
          )
          .max(100),
      }),
    })
    .safeParse(value);
  if (!parsed.success) return null;
  return [
    ...new Map(
      parsed.data.current_period.best_runs.flatMap((run) => {
        const at = new Date(run.completed_timestamp);
        if (!Number.isFinite(at.getTime())) return [];
        return [
          [
            `${run.dungeon.id}:${run.completed_timestamp}:${run.keystone_level}`,
            {
              level: run.keystone_level,
              dungeon: run.dungeon.name,
              completedAt: at.toISOString(),
            },
          ] as const,
        ];
      }),
    ).values(),
  ];
}
