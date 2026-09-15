'use client';

import { useActionState } from 'react';
import {
  makeMainCharacter,
  type CharacterStatusState,
} from './actions';

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
  const [state, formAction, isPending] = useActionState(
    makeMainCharacter,
    initialState,
  );

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-6">
      <h2 className="font-display text-xl text-text-primary">
        Main Character
      </h2>

      {isMain ? (
        <p className="mt-2 text-sm text-text-muted">
          This is your Main. To switch, open another saved character
          and choose Make Main.
        </p>
      ) : (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="characterId" value={characterId} />

          <p className="text-sm text-text-muted">
            Making this character your Main will mark your current
            Main as an Alternate.
          </p>

          <button
            type="submit"
            disabled={isPending}
            className="mt-4 rounded-md bg-accent px-5 py-2.5 font-medium text-background hover:bg-accent-hover disabled:opacity-60"
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

      <p role="status" className="mt-3 text-sm text-text-muted">
        {state.success}
      </p>
    </div>
  );
}