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
      note: z.string().optional(),
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
  const acceptedRequests = tracker.requests.filter((request) =>
    ['accepted', 'in_progress', 'done'].includes(request.status),
  );
  const completedMilestones = tracker.milestones.filter(
    (milestone) =>
      milestone.status === 'implemented' &&
      milestone.work.every((item) => item.status === 'done') &&
      acceptedRequests
        .filter((request) => request.milestone === milestone.number)
        .every((request) => request.status === 'done'),
  ).length;
  // Linked requests count within their milestone; standalone accepted scope counts once.
  const standaloneRequests = acceptedRequests.filter(
    (request) => !tracker.milestones.some((milestone) => milestone.number === request.milestone),
  );
  const verified = tracker.acceptance.filter((item) => item.status === 'verified').length;
  const completed =
    completedMilestones +
    verified +
    standaloneRequests.filter((request) => request.status === 'done').length;
  const required = total + tracker.acceptance.length + standaloneRequests.length;
  return {
    implemented,
    total,
    verified,
    acceptanceTotal: tracker.acceptance.length,
    completed,
    required,
    percent: required ? Math.floor((completed / required) * 100) : 0,
    featurePercent: total ? Math.floor((implemented / total) * 100) : 0,
    openRequests: acceptedRequests.filter((request) => request.status !== 'done'),
    openWork: tracker.milestones.flatMap((milestone) =>
      milestone.work
        .filter((item) => item.status !== 'done')
        .map((item) => ({
          ...item,
          milestone: milestone.number,
        })),
    ),
  };
}
