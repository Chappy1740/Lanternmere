'use client';

import { useActionState } from 'react';
import { deleteChronicle, type ChronicleState } from '@/app/(app)/(lodge)/chronicles/actions';

const initialState: ChronicleState = { error: null, success: null };

export function DeleteChronicleControl({ chronicleId }: { chronicleId: string }) {
  const [state, formAction, isPending] = useActionState(deleteChronicle, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="chronicleId" value={chronicleId} />
      <button
        type="submit"
        disabled={isPending}
        className="border border-red-400 px-4 py-2 text-sm text-red-400 disabled:opacity-60"
      >
        {isPending ? 'Removing…' : 'Remove Chronicle'}
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
