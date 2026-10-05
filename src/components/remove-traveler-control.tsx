'use client';

import { useActionState, useState } from 'react';
import { removeTraveler, type CharacterStatusState } from '@/app/(app)/travelers/[id]/actions';

const initialState: CharacterStatusState = { error: null, success: null };

export function RemoveTravelerControl({
  characterId,
  name,
  isMain,
}: {
  characterId: string;
  name: string;
  isMain: boolean;
}) {
  const [state, action, pending] = useActionState(removeTraveler, initialState);
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="lodge-panel mt-6 p-6">
      <h2 className="font-display text-xl">Remove Traveler</h2>
      <p className="text-text-muted mt-2 text-sm">
        Remove {name} from Lanternmere, including saved profiles, progression history, and sharing.
        This does not delete your WoW character. You can add it again from Battle.net, but its saved
        Lanternmere data cannot be restored.
      </p>
      {isMain && (
        <p className="text-text-muted mt-2 text-sm">
          This is your Main. After removal, choose another Main or add one from Battle.net.
        </p>
      )}
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="characterId" value={characterId} />
        {confirming ? (
          <>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" required disabled={pending} className="mt-1" />I
              understand that removing this Traveler permanently deletes its saved Lanternmere data.
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={pending}
                className="lodge-button px-4 py-2 disabled:opacity-60"
              >
                {pending ? 'Removing…' : 'Confirm removal'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className="lodge-button-secondary px-4 py-2"
              >
                Keep Traveler
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="lodge-button-secondary px-4 py-2"
          >
            Remove Traveler
          </button>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-red-300">
            {state.error}
          </p>
        )}
      </form>
    </section>
  );
}
