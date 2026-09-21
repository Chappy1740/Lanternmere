import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DeleteEventControl } from '@/components/delete-event-control';
import { EventRsvpControl } from '@/components/event-rsvp-control';
import { eventDateTime, loadEventDetail } from '@/lib/quest-board/events';
import { eventRoleLabel, groupComposition } from '@/lib/quest-board/events';
import { z } from 'zod';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function EventDetailPage({
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
      ? memberships.find((membership) => membership.lodge_id === query.lodge)
      : undefined;
  if (!selected) notFound();
  const { event, attendees } = await loadEventDetail(supabase, id, selected.lodge_id);
  if (!event) notFound();
  const currentAttendee = attendees?.find((attendee) => attendee.profile_id === user.id);
  const { data: characterData, error: characterError } = await supabase
    .from('characters')
    .select('id, character_name, realm_slug')
    .eq('profile_id', user.id)
    .order('character_name')
    .limit(100);
  const characters = characterError
    ? []
    : (z
        .array(z.object({ id: z.uuid(), character_name: z.string(), realm_slug: z.string() }))
        .safeParse(characterData).data ?? []);
  const composition = attendees ? groupComposition(attendees) : [];
  const canManage =
    event.created_by === user.id || selected.role === 'owner' || selected.role === 'caretaker';
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link
        href={`/quest-board?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to Quest Board
      </Link>
      <article className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">{event.activity_type?.trim() || 'Lodge event'}</p>
        <h1 className="font-display text-text-primary mt-3 text-4xl font-bold break-words">
          {event.title.trim() || 'Lodge event'}
        </h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <p className="lodge-data-cell text-text-muted text-sm">
            <span className="text-text-primary block font-medium">When</span>
            <time dateTime={event.event_date}>{eventDateTime(event)}</time> (UTC)
          </p>
          {event.difficulty?.trim() && (
            <p className="lodge-data-cell text-text-muted text-sm">
              <span className="text-text-primary block font-medium">Difficulty</span>
              {event.difficulty}
            </p>
          )}
        </div>
        {event.notes?.trim() && (
          <section aria-labelledby="strategy-heading" className="mt-6">
            <p className="lodge-kicker">Before the gathering</p>
            <h2 id="strategy-heading" className="font-display text-text-primary mt-2 text-xl">
              Strategy and preparation
            </h2>
            <p className="text-text-primary mt-3 break-words whitespace-pre-line">{event.notes}</p>
          </section>
        )}
        {canManage && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={`/quest-board/${event.id}/edit?lodge=${selected.lodge_id}`}
              className="lodge-button px-4 py-2 font-medium"
            >
              Edit event
            </Link>
            <DeleteEventControl eventId={event.id} />
          </div>
        )}
      </article>
      <div className="grid gap-8 lg:grid-cols-2">
        <EventRsvpControl
          eventId={event.id}
          currentStatus={currentAttendee?.rsvp_status}
          currentRole={currentAttendee?.role}
          currentCharacterId={currentAttendee?.character_id}
          characters={characters}
        />
        <section aria-labelledby="participants-heading" className="lodge-panel p-6">
          <p className="lodge-kicker">Those who answered</p>
          <h2 id="participants-heading" className="font-display text-text-primary mt-2 text-xl">
            Participants
          </h2>
          {composition.length > 0 && (
            <div
              className="border-border mt-4 flex flex-wrap gap-2 border-y py-3"
              aria-label="Confirmed group composition"
            >
              {composition.map(({ role, count }) => (
                <span
                  key={role}
                  className="bg-background text-text-primary rounded-full px-3 py-1 text-xs"
                >
                  {eventRoleLabel(role)}: {count}
                </span>
              ))}
            </div>
          )}
          {attendees === null ? (
            <p role="alert" className="text-text-muted mt-3 text-sm">
              Participants could not be loaded. Please try again later.
            </p>
          ) : attendees.length === 0 ? (
            <p className="text-text-muted mt-3 text-sm">No one has answered the call yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {attendees.map((attendee) => (
                <li key={attendee.id} className="lodge-list-row p-4">
                  <p className="text-text-primary break-words">
                    {attendee.profiles?.display_name?.trim() || 'Lodge member'}
                    {attendee.profile_id === user.id ? ' (you)' : ''}
                  </p>
                  <p className="text-text-muted mt-1 text-sm capitalize">
                    {attendee.rsvp_status}
                    {attendee.role?.trim() ? ` · ${eventRoleLabel(attendee.role)}` : ''}
                    {attendee.characters ? ` · ${attendee.characters.character_name}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
