'use client';

import { useActionState } from 'react';
import { updateRsvp, type QuestBoardState } from '@/app/(app)/(lodge)/quest-board/actions';

const initialState: QuestBoardState = { error: null, success: null };

export function EventRsvpControl({
  eventId,
  currentStatus,
}: {
  eventId: string;
  currentStatus?: string;
}) {
  const [state, formAction, isPending] = useActionState(updateRsvp, initialState);
  return (
    <form action={formAction} className="border-border bg-surface rounded-lg border p-6">
      <input type="hidden" name="eventId" value={eventId} />
      <fieldset disabled={isPending}>
        <legend className="font-display text-text-primary text-xl">Your attendance</legend>
        <p className="text-text-muted mt-2 text-sm">Let the Lodge know whether you can make it.</p>
        <label className="text-text-primary mt-4 flex flex-col gap-2 text-sm font-medium">
          RSVP status
          <select
            name="status"
            defaultValue={currentStatus ?? 'tentative'}
            className="border-border bg-background rounded-md border px-3 py-2 font-normal"
          >
            <option value="confirmed">Confirmed</option>
            <option value="tentative">Tentative</option>
            <option value="declined">Declined</option>
          </select>
        </label>
        <button
          type="submit"
          className="bg-accent text-background hover:bg-accent-hover mt-5 rounded-md px-5 py-2.5 font-medium disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save RSVP'}
        </button>
      </fieldset>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted mt-3 text-sm">
          {state.success}
        </p>
      )}
    </form>
  );
}
