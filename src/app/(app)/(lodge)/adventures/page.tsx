import Link from 'next/link';
import { CalendarDays, Map, Plus, Swords } from 'lucide-react';
import { notFound } from 'next/navigation';
import { eventDateTime, loadQuestBoard } from '@/lib/quest-board/events';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function AdventuresPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
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
        ? memberships.find((membership) => membership.lodge_id === params.lodge)
        : undefined;
  if (!selected) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const { upcoming } = await loadQuestBoard(supabase, selected.lodge_id, today);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="lodge-panel flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="text-accent mb-3 flex items-center gap-2 text-sm">
            <Swords size={18} aria-hidden="true" /> The road ahead
          </p>
          <h1 className="font-display text-text-primary text-3xl font-bold sm:text-4xl">
            Adventures
          </h1>
          <p className="text-text-muted mt-3">
            Gather the next expedition for {selected.lodges.name}.
          </p>
        </div>
        <Link
          href={`/quest-board/new?lodge=${selected.lodge_id}`}
          className="lodge-button inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium"
        >
          <Plus size={18} aria-hidden="true" /> Plan an adventure
        </Link>
      </header>

      <section aria-labelledby="next-adventures-heading" className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">On the horizon</p>
        <h2
          id="next-adventures-heading"
          className="font-display text-text-primary mt-2 text-2xl font-bold"
        >
          Next adventures
        </h2>
        {upcoming === null ? (
          <p role="alert" className="text-text-muted mt-5">
            Upcoming adventures could not be loaded. Please try again later.
          </p>
        ) : upcoming.length === 0 ? (
          <div className="lodge-empty mt-5 p-6">
            <p className="text-text-primary font-medium">The map is open.</p>
            <p className="text-text-muted mt-2 text-sm">
              Start with a Quest Board event to give the Lodge a destination and a time to gather.
            </p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {upcoming.slice(0, 6).map((event) => (
              <li key={event.id} className="lodge-list-row p-5">
                <p className="text-accent flex items-center gap-2 text-sm">
                  <Map size={16} aria-hidden="true" />{' '}
                  {event.activity_type?.trim() || 'Lodge event'}
                </p>
                <Link
                  href={`/quest-board/${event.id}?lodge=${selected.lodge_id}`}
                  className="font-display text-text-primary hover:text-accent mt-3 block text-xl font-bold underline-offset-4 hover:underline"
                >
                  {event.title}
                </Link>
                <p className="text-text-muted mt-2 text-sm">{eventDateTime(event)} UTC</p>
                {event.difficulty?.trim() && (
                  <p className="text-text-primary mt-3 text-sm">{event.difficulty}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="lodge-panel p-6">
          <CalendarDays className="text-accent" size={22} aria-hidden="true" />
          <h2 className="font-display text-text-primary mt-4 text-xl font-bold">Build the party</h2>
          <p className="text-text-muted mt-2 text-sm leading-6">
            Quest Board RSVPs keep attendance, Traveler choices, and group roles together for each
            outing.
          </p>
          <Link
            href={`/quest-board?lodge=${selected.lodge_id}`}
            className="text-accent hover:text-accent-hover mt-5 inline-block text-sm underline underline-offset-4"
          >
            Open Quest Board
          </Link>
        </article>
        <article className="lodge-panel p-6">
          <Map className="text-accent" size={22} aria-hidden="true" />
          <h2 className="font-display text-text-primary mt-4 text-xl font-bold">
            More roads ahead
          </h2>
          <p className="text-text-muted mt-2 text-sm leading-6">
            Recurring goals, campaign plans, and saved route notes are the next Adventures
            expansion.
          </p>
        </article>
      </section>
    </div>
  );
}
