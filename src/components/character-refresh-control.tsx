'use client';

import { useActionState } from 'react';
import { addCharacter, type AddCharacterState } from '@/app/(app)/travelers/new/actions';

const initialState: AddCharacterState = { error: null };

export function CharacterRefreshControl({
  region,
  realm,
  name,
  returnToHearth = false,
}: {
  region: string;
  realm: string;
  name: string;
  returnToHearth?: boolean;
}) {
  const [state, action, pending] = useActionState(addCharacter, initialState);
  return (
    <form action={action} className="min-w-0">
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="realm" value={realm} />
      <input type="hidden" name="characterName" value={name} />
      {returnToHearth && <input type="hidden" name="returnTo" value="hearth" />}
      <button
        type="submit"
        disabled={pending}
        className="lodge-button-secondary rounded px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? 'Refreshing…' : 'Refresh Blizzard profile'}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 max-w-sm text-sm text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
