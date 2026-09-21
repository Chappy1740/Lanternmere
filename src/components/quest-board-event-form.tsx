'use client';

import { useActionState } from 'react';
import type { QuestBoardState } from '@/app/(app)/(lodge)/quest-board/actions';
import type { EventTemplate } from '@/lib/adventures/event-templates';
import type { LodgeEvent } from '@/lib/quest-board/events';

const initialState: QuestBoardState = { error: null, success: null };
type EventAction = (state: QuestBoardState, formData: FormData) => Promise<QuestBoardState>;

export function QuestBoardEventForm({
  action,
  lodgeId,
  event,
  template,
}: {
  action: EventAction;
  lodgeId: string;
  event?: LodgeEvent;
  template?: EventTemplate;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="lodge-panel p-6 sm:p-8">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      {event && <input type="hidden" name="eventId" value={event.id} />}
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          Quest title
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={event?.title ?? template?.title}
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Date
          <input
            name="eventDate"
            type="date"
            required
            defaultValue={event?.event_date}
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Time <span className="text-text-muted font-normal">optional; shown as recorded</span>
          <input
            name="eventTime"
            type="time"
            defaultValue={event?.event_time?.slice(0, 5) ?? template?.event_time?.slice(0, 5)}
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Activity type
          <input
            name="activityType"
            maxLength={80}
            defaultValue={event?.activity_type ?? template?.activity_type ?? ''}
            placeholder="Raid, Mythic+, PvP…"
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Difficulty
          <input
            name="difficulty"
            maxLength={80}
            defaultValue={event?.difficulty ?? template?.difficulty ?? ''}
            placeholder="Heroic, casual, progression…"
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          Strategy and preparation
          <textarea
            name="notes"
            rows={6}
            maxLength={2000}
            defaultValue={event?.notes ?? template?.notes ?? ''}
            className="lodge-field px-3 py-2 font-normal"
          />
          <span className="text-text-muted text-xs font-normal">
            Share the route, encounter plan, supplies, voice details, or anything the party should
            know before gathering.
          </span>
        </label>
      </div>
      {state.error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted mt-5 text-sm">
          {state.success}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="lodge-button mt-6 px-5 py-2.5 font-medium disabled:opacity-60"
      >
        {isPending ? 'Saving…' : event ? 'Save event' : 'Post event'}
      </button>
    </form>
  );
}
