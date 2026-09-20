import Link from 'next/link';
import { Plus, Search, Trophy } from 'lucide-react';
import { notFound } from 'next/navigation';
import { achievementCredit, achievementDate, loadAchievements } from '@/lib/achievements';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function HallOfLegendsPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[]; q?: string | string[] }>;
}) {
  const [memberships, params, { supabase }] = await Promise.all([
    getLodgeMemberships(),
    searchParams,
    getViewer(),
  ]);
  const selected =
    params.lodge === undefined
      ? memberships[0]
      : typeof params.lodge === 'string'
        ? memberships.find((member) => member.lodge_id === params.lodge)
        : undefined;
  if (!selected) notFound();
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 80) : '';
  const achievements = await loadAchievements(supabase, selected.lodge_id, query);
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="lodge-panel flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="text-accent mb-3 flex items-center gap-2 text-sm">
            <Trophy size={18} aria-hidden="true" /> The records endure
          </p>
          <h1 className="font-display text-text-primary text-3xl font-bold sm:text-4xl">
            Hall of Legends
          </h1>
          <p className="text-text-muted mt-3">
            The victories remembered by {selected.lodges.name}.
          </p>
        </div>
        <Link
          href={`/hall-of-legends/new?lodge=${selected.lodge_id}`}
          className="lodge-button inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium"
        >
          <Plus size={18} aria-hidden="true" /> Record an achievement
        </Link>
      </header>
      <form className="lodge-panel flex gap-3 p-4" role="search">
        <input type="hidden" name="lodge" value={selected.lodge_id} />
        <label className="sr-only" htmlFor="achievement-search">
          Search achievements
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2"
            size={17}
            aria-hidden="true"
          />
          <input
            id="achievement-search"
            name="q"
            defaultValue={query}
            maxLength={80}
            placeholder="Search achievements"
            className="lodge-field w-full py-2 pr-3 pl-10"
          />
        </div>
        <button type="submit" className="lodge-button-secondary px-4 py-2 text-sm font-medium">
          Search
        </button>
      </form>
      <section aria-labelledby="achievement-list-heading" className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Lodge record</p>
        <h2
          id="achievement-list-heading"
          className="font-display text-text-primary mt-2 text-2xl font-bold"
        >
          {query ? 'Matching achievements' : 'Recent achievements'}
        </h2>
        {achievements === null ? (
          <p role="alert" className="text-text-muted mt-5">
            Achievements could not be loaded. Please try again later.
          </p>
        ) : achievements.length === 0 ? (
          <div className="lodge-empty mt-5 p-6">
            <p className="text-text-primary font-medium">
              {query
                ? 'No achievements matched that search.'
                : 'The Hall is ready for its first legend.'}
            </p>
            <p className="text-text-muted mt-2 text-sm">
              {query
                ? 'Try another word or clear the search.'
                : 'Record a personal triumph or a milestone shared by the whole Lodge.'}
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-4">
            {achievements.map((achievement) => (
              <li key={achievement.id} className="lodge-list-row p-5">
                <Link
                  href={`/hall-of-legends/${achievement.id}?lodge=${selected.lodge_id}`}
                  className="font-display text-accent hover:text-accent-hover text-xl font-bold underline-offset-4 hover:underline"
                >
                  {achievement.title}
                </Link>
                <p className="text-text-muted mt-2 text-sm">
                  {achievementDate(achievement.achieved_at, achievement.created_at)} ·{' '}
                  {achievementCredit(achievement)} ·{' '}
                  {achievement.source === 'blizzard' ? 'Blizzard' : 'Lodge record'}
                </p>
                {achievement.description && (
                  <p className="text-text-primary mt-3 break-words">{achievement.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
