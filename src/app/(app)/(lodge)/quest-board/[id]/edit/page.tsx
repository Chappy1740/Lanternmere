import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuestBoardEventForm } from '@/components/quest-board-event-form';
import { loadEventDetail } from '@/lib/quest-board/events';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';
import { updateEvent } from '../../actions';

export default async function EditEventPage({
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
  const { event } = await loadEventDetail(supabase, id, selected.lodge_id);
  if (!event) notFound();
  const canManage =
    event.created_by === user.id || selected.role === 'owner' || selected.role === 'caretaker';
  if (!canManage) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/quest-board/${event.id}?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to event
      </Link>
      <h1 className="font-display text-text-primary mt-6 text-3xl font-bold">Edit event</h1>
      <div className="mt-8">
        <QuestBoardEventForm action={updateEvent} lodgeId={selected.lodge_id} event={event} />
      </div>
    </div>
  );
}
