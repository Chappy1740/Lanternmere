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
    <div className="border-border bg-surface mt-6 rounded-lg border p-6">
      <h2 className="font-display text-text-primary text-xl">Main Character</h2>

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
            className="bg-accent text-background hover:bg-accent-hover mt-4 rounded-md px-5 py-2.5 font-medium disabled:opacity-60"
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
