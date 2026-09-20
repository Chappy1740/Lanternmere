import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteAchievementControl } from '@/components/delete-achievement-control';
import { achievementCredit, achievementDate, loadAchievement } from '@/lib/achievements';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function AchievementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [{ id }, query, memberships, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    getLodgeMemberships(),
    getViewer(),
  ]);
  const selected =
    typeof query.lodge === 'string'
      ? memberships.find((member) => member.lodge_id === query.lodge)
      : undefined;
  if (!selected) notFound();
  const achievement = await loadAchievement(supabase, id, selected.lodge_id);
  if (!achievement) notFound();
  const canManage =
    achievement.created_by === user.id ||
    selected.role === 'owner' ||
    selected.role === 'caretaker';
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href={`/hall-of-legends?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to Hall of Legends
      </Link>
      <article className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">
          {achievementDate(achievement.achieved_at, achievement.created_at)}
        </p>
        <h1 className="font-display text-text-primary mt-3 text-4xl font-bold break-words">
          {achievement.title}
        </h1>
        <p className="text-text-muted mt-3 text-sm">
          {achievementCredit(achievement)} ·{' '}
          {achievement.source === 'blizzard'
            ? 'Verified by Blizzard'
            : 'Recorded by a Lodge member'}
        </p>
        {achievement.description && (
          <div className="text-text-primary mt-8 leading-7 break-words whitespace-pre-line">
            {achievement.description}
          </div>
        )}
        {canManage && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={`/hall-of-legends/${achievement.id}/edit?lodge=${selected.lodge_id}`}
              className="lodge-button px-4 py-2 font-medium"
            >
              Edit achievement
            </Link>
            <DeleteAchievementControl achievementId={achievement.id} />
          </div>
        )}
      </article>
    </div>
  );
}
