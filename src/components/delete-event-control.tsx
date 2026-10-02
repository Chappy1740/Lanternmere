'use client';

import { useActionState, useState } from 'react';
import { deleteEvent, type QuestBoardState } from '@/app/(app)/(lodge)/quest-board/actions';

const initialState: QuestBoardState = { error: null, success: null };

export function DeleteEventControl({ eventId }: { eventId: string }) {
  const [state, formAction, isPending] = useActionState(deleteEvent, initialState);
  const [confirming, setConfirming] = useState(false);
  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      {confirming ? (
        <div className="space-y-3">
          <p className="text-text-muted max-w-sm text-sm">
            Remove this event and its RSVPs? This cannot be undone. Events linked to Guild raid
            records cannot be removed.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="border border-red-400 px-4 py-2 text-sm text-red-400 disabled:opacity-60"
            >
              {isPending ? 'Removing…' : 'Yes, remove event'}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              className="border-border text-text-muted rounded border px-4 py-2 text-sm disabled:opacity-60"
            >
              Keep event
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="border border-red-400 px-4 py-2 text-sm text-red-400"
        >
          Remove event
        </button>
      )}
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
