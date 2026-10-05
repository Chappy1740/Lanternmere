'use client';

import { useActionState } from 'react';
import { addOwnedTraveler, type AddOwnedTravelerState } from '@/app/(app)/account/actions';

const initialState: AddOwnedTravelerState = { error: null };

export function AddOwnedTravelerControl({
  characterId,
  added,
  previouslyImported,
}: {
  characterId: number;
  added: boolean;
  previouslyImported: boolean;
}) {
  const [state, action, pending] = useActionState(addOwnedTraveler, initialState);
  return (
    <form action={action} className="flex min-w-0 flex-col items-start gap-1">
      <input type="hidden" name="characterId" value={characterId} />
      <button
        type="submit"
        disabled={pending || added}
        className="lodge-button-secondary rounded px-3 py-2 text-sm disabled:opacity-60"
      >
        {added
          ? 'Verified in Travelers'
          : pending
            ? previouslyImported
              ? 'Verifying…'
              : 'Adding…'
            : previouslyImported
              ? 'Verify ownership'
              : 'Add to Travelers'}
      </button>
      {state.error && (
        <p role="alert" className="max-w-xs text-sm text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
