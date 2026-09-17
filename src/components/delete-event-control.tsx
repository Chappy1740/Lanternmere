'use client';

import { useActionState } from 'react';
import { deleteEvent, type QuestBoardState } from '@/app/(app)/(lodge)/quest-board/actions';

const initialState: QuestBoardState = { error: null, success: null };

export function DeleteEventControl({ eventId }: { eventId: string }) {
  const [state, formAction, isPending] = useActionState(deleteEvent, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <button
        type="submit"
        disabled={isPending}
        className="border border-red-400 px-4 py-2 text-sm text-red-400 disabled:opacity-60"
      >
        {isPending ? 'Removing…' : 'Remove event'}
      </button>
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
