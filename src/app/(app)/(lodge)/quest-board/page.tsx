import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { notFound } from 'next/navigation';
import { eventDateTime, loadQuestBoard, type LodgeEvent } from '@/lib/quest-board/events';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

function EventList({ events, lodgeId }: { events: LodgeEvent[]; lodgeId: string }) {
  return (
    <ul className="mt-5 grid gap-4 lg:grid-cols-2">
      {events.map((event) => (
        <li key={event.id} className="lodge-panel lodge-panel-interactive p-5">
          <Link
            href={`/quest-board/${event.id}?lodge=${lodgeId}`}
            className="font-display text-accent hover:text-accent-hover text-xl font-bold underline-offset-4 hover:underline"
          >
            {event.title.trim() || 'Lodge event'}
          </Link>
          <p className="text-text-muted mt-2 text-sm">{eventDateTime(event)} (UTC)</p>
          {[event.activity_type, event.difficulty].filter(Boolean).length > 0 && (
            <p className="text-text-primary mt-3 text-sm">
              {[event.activity_type, event.difficulty].filter(Boolean).join(' · ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function QuestBoardPage({
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
  const { upcoming, past } = await loadQuestBoard(supabase, selected.lodge_id, today);
  const lodgeId = selected.lodge_id;
  return (
    <div className="mx-auto max-w-5xl space-y-9">
      <header className="lodge-panel flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="text-accent mb-3 flex items-center gap-2 text-sm">
            <CalendarDays size={18} aria-hidden="true" /> Lodge gatherings
          </p>
          <h1 className="font-display text-text-primary text-3xl font-bold sm:text-4xl">
            Quest Board
          </h1>
          <p className="text-text-muted mt-3">
            Plans, parties, and the next road out from {selected.lodges.name}.
          </p>
        </div>
        <Link
          href={`/quest-board/new?lodge=${lodgeId}`}
          className="lodge-button inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium"
        >
          <Plus size={18} aria-hidden="true" /> Create event
        </Link>
      </header>
      <section aria-labelledby="upcoming-heading" className="lodge-panel p-6">
        <h2 id="upcoming-heading" className="font-display text-text-primary text-2xl font-bold">
          Upcoming quests
        </h2>
        {upcoming === null ? (
          <p role="alert" className="text-text-muted mt-4">
            Upcoming events could not be loaded. Please try again later.
          </p>
        ) : upcoming.length === 0 ? (
          <div className="lodge-empty mt-5 p-6">
            <p className="text-text-primary font-medium">The board is quiet for now.</p>
            <p className="text-text-muted mt-2 text-sm">
              Post the next adventure when your Lodge is ready to gather.
            </p>
          </div>
        ) : (
          <EventList events={upcoming} lodgeId={lodgeId} />
        )}
      </section>
      <section aria-labelledby="past-heading" className="lodge-panel p-6">
        <h2 id="past-heading" className="font-display text-text-primary text-2xl font-bold">
          Past quests
        </h2>
        <p className="text-text-muted mt-2 text-sm">
          The twelve most recent events, kept for the Lodge record.
        </p>
        {past === null ? (
          <p role="alert" className="text-text-muted mt-4">
            Past events could not be loaded. Please try again later.
          </p>
        ) : past.length === 0 ? (
          <p className="text-text-muted mt-4">No past quests have been recorded yet.</p>
        ) : (
          <EventList events={past} lodgeId={lodgeId} />
        )}
      </section>
      {memberships.length > 1 && (
        <nav aria-label="Choose a Lodge">
          <h2 className="font-display text-text-primary text-lg">
            View another Lodge&apos;s board
          </h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {memberships.map((membership) => (
              <li key={membership.lodge_id}>
                <Link
                  href={`/quest-board?lodge=${membership.lodge_id}`}
                  aria-current={membership.lodge_id === lodgeId ? 'page' : undefined}
                  className="border-border text-accent hover:bg-surface block rounded-md border px-4 py-2"
                >
                  {membership.lodges.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
