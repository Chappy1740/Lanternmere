'use client';

import { useActionState } from 'react';
import { deleteChronicleMedia, type ChronicleState } from '@/app/(app)/(lodge)/chronicles/actions';

const initialState: ChronicleState = { error: null, success: null };

export function DeleteChronicleMediaControl({ mediaId }: { mediaId: string }) {
  const [state, formAction, isPending] = useActionState(deleteChronicleMedia, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="mediaId" value={mediaId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-sm text-red-400 underline underline-offset-4 disabled:opacity-60"
      >
        {isPending ? 'Removing…' : 'Remove image'}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted mt-2 text-sm">
          {state.success}
        </p>
      )}
    </form>
  );
}
