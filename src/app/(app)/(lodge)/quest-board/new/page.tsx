import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuestBoardEventForm } from '@/components/quest-board-event-form';
import { loadEventTemplate } from '@/lib/adventures/event-templates';
import { createEvent } from '../actions';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[]; template?: string | string[] }>;
}) {
  const [memberships, params, { supabase }] = await Promise.all([
    getLodgeMemberships(),
    searchParams,
    getViewer(),
  ]);
  const selected =
    typeof params.lodge === 'string'
      ? memberships.find((membership) => membership.lodge_id === params.lodge)
      : undefined;
  if (!selected) notFound();
  const template =
    typeof params.template === 'string'
      ? await loadEventTemplate(supabase, params.template, selected.lodge_id)
      : null;
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/quest-board?lodge=${selected.lodge_id}`}
        className="text-accent hover:text-accent-hover underline underline-offset-4"
      >
        Back to Quest Board
      </Link>
      <header className="lodge-panel mt-6 p-6 sm:p-8">
        <p className="lodge-kicker">Quest Board</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">Post a new quest</h1>
        <p className="text-text-muted mt-2">
          {template
            ? `Starting from the ${template.title} recurring plan. Choose the date for this outing.`
            : `This event will be visible to members of ${selected.lodges.name}.`}
        </p>
      </header>
      <div className="mt-8">
        <QuestBoardEventForm
          action={createEvent}
          lodgeId={selected.lodge_id}
          template={template ?? undefined}
        />
      </div>
    </div>
  );
}
