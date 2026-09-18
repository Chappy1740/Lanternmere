'use client';

import { useActionState } from 'react';
import { makeMainCharacter, type CharacterStatusState } from './actions';

const initialState: CharacterStatusState = {
  error: null,
  success: null,
};

export function MainCharacterControl({
  characterId,
  isMain,
}: {
  characterId: string;
  isMain: boolean;
}) {
  const [state, formAction, isPending] = useActionState(makeMainCharacter, initialState);

  return (
    <div className="lodge-panel mt-6 p-6">
      <p className="lodge-kicker">Character standing</p>
      <h2 className="font-display text-text-primary mt-2 text-xl">Main Character</h2>

      {isMain ? (
        <p className="text-text-muted mt-2 text-sm">
          This is your Main. To switch, open another saved character and choose Make Main.
        </p>
      ) : (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="characterId" value={characterId} />

          <p className="text-text-muted text-sm">
            Making this character your Main will mark your current Main as an Alternate.
          </p>

          <button
            type="submit"
            disabled={isPending}
            className="lodge-button mt-4 px-5 py-2.5 font-medium disabled:opacity-60"
          >
            {isPending ? 'Updating...' : 'Make Main'}
          </button>
        </form>
      )}

      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <p role="status" className="text-text-muted mt-3 text-sm">
        {state.success}
      </p>
    </div>
  );
}
