import { z } from 'zod';
import bundledTracker from '../../docs/project-tracker.json';

const workSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['todo', 'in_progress', 'done']),
});

export const trackerSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.iso.date(),
  milestones: z.array(
    z.object({
      number: z.number().int().nonnegative(),
      name: z.string(),
      description: z.string().optional(),
      specification: z
        .string()
        .regex(/^milestone-\d{2}-[a-z-]+\.md$/)
        .optional(),
      status: z.enum(['planned', 'in_progress', 'implemented']),
      work: z.array(workSchema),
    }),
  ),
  requests: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      requestedAt: z.iso.date(),
      milestone: z.number().int().nonnegative().nullable(),
      status: z.enum(['proposed', 'accepted', 'in_progress', 'done', 'declined']),
      note: z.string(),
    }),
  ),
  acceptance: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(['open', 'verified']),
    }),
  ),
});

export type ProjectTracker = z.infer<typeof trackerSchema>;
export const bundledProjectTracker: ProjectTracker = trackerSchema.parse(bundledTracker);

export function projectProgress(tracker: ProjectTracker) {
  const implemented = tracker.milestones.filter(
    (milestone) => milestone.status === 'implemented',
  ).length;
  const total = tracker.milestones.length;
  return { implemented, total, percent: total ? Math.round((implemented / total) * 100) : 0 };
}
