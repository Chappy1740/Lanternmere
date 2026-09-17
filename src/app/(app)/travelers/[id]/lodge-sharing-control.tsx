'use client';

import { useActionState, useState } from 'react';
import { updateLodgeSharing, type LodgeSharingState } from './sharing-actions';

const initialState: LodgeSharingState = {
  error: null,
  success: null,
};

type Lodge = {
  id: string;
  name: string;
};

export function LodgeSharingControl({
  characterId,
  lodges,
  selectedLodgeIds,
}: {
  characterId: string;
  lodges: Lodge[];
  selectedLodgeIds: string[];
}) {
  const [state, formAction, isPending] = useActionState(updateLodgeSharing, initialState);

  const [selected, setSelected] = useState(selectedLodgeIds);
  const [showMessage, setShowMessage] = useState(false);

  function toggleLodge(lodgeId: string, checked: boolean) {
    setShowMessage(false);
    setSelected((previous) =>
      checked ? [...new Set([...previous, lodgeId])] : previous.filter((id) => id !== lodgeId),
    );
  }

  return (
    <section className="border-border bg-surface mt-6 rounded-lg border p-6">
      <h2 className="font-display text-text-primary text-xl">Lodge Sharing</h2>

      <p className="text-text-muted mt-2 text-sm">
        Members of selected Lodges can view this character and its saved profile. Leave every box
        unchecked to remove all sharing.
      </p>

      <form
        action={formAction}
        onSubmit={() => setShowMessage(true)}
        onReset={(event) => event.preventDefault()}
        className="mt-4"
      >
        <input type="hidden" name="characterId" value={characterId} />

        <fieldset disabled={isPending} className="flex flex-col gap-3">
          <legend className="sr-only">Choose Lodges</legend>

          {lodges.length === 0 ? (
            <p className="text-text-muted text-sm">
              You do not currently belong to any Lodges. You can still remove any previous sharing
              by saving below.
            </p>
          ) : (
            lodges.map((lodge) => (
              <label
                key={lodge.id}
                className="border-border bg-background flex cursor-pointer items-center gap-3 rounded-md border p-3"
              >
                <input
                  type="checkbox"
                  name="lodgeIds"
                  value={lodge.id}
                  checked={selected.includes(lodge.id)}
                  onChange={(event) => toggleLodge(lodge.id, event.target.checked)}
                  className="accent-accent h-4 w-4"
                />
                <span className="text-text-primary">{lodge.name}</span>
              </label>
            ))
          )}

          <button
            type="submit"
            className="bg-accent text-background hover:bg-accent-hover mt-2 self-start rounded-md px-5 py-2.5 font-medium disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Save Sharing'}
          </button>
        </fieldset>

        {showMessage && !isPending && state.error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {state.error}
          </p>
        )}

        <p role="status" className="text-text-muted mt-3 text-sm">
          {showMessage && !isPending ? state.success : null}
        </p>
      </form>
    </section>
  );
}
