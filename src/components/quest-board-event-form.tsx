'use client';

import { useActionState } from 'react';
import type { QuestBoardState } from '@/app/(app)/(lodge)/quest-board/actions';
import type { LodgeEvent } from '@/lib/quest-board/events';

const initialState: QuestBoardState = { error: null, success: null };
type EventAction = (state: QuestBoardState, formData: FormData) => Promise<QuestBoardState>;

export function QuestBoardEventForm({
  action,
  lodgeId,
  event,
}: {
  action: EventAction;
  lodgeId: string;
  event?: LodgeEvent;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="border-border bg-surface rounded-lg border p-6 sm:p-8">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      {event && <input type="hidden" name="eventId" value={event.id} />}
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          Quest title
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={event?.title}
            className="border-border bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Date
          <input
            name="eventDate"
            type="date"
            required
            defaultValue={event?.event_date}
            className="border-border bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Time <span className="text-text-muted font-normal">optional; shown as recorded</span>
          <input
            name="eventTime"
            type="time"
            defaultValue={event?.event_time?.slice(0, 5)}
            className="border-border bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Activity type
          <input
            name="activityType"
            maxLength={80}
            defaultValue={event?.activity_type ?? ''}
            placeholder="Raid, Mythic+, PvP…"
            className="border-border bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Difficulty
          <input
            name="difficulty"
            maxLength={80}
            defaultValue={event?.difficulty ?? ''}
            placeholder="Heroic, casual, progression…"
            className="border-border bg-background rounded-md border px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={6}
            maxLength={2000}
            defaultValue={event?.notes ?? ''}
            className="border-border bg-background rounded-md border px-3 py-2 font-normal"
          />
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
        className="bg-accent text-background hover:bg-accent-hover mt-6 rounded-md px-5 py-2.5 font-medium disabled:opacity-60"
      >
        {isPending ? 'Saving…' : event ? 'Save event' : 'Post event'}
      </button>
    </form>
  );
}
