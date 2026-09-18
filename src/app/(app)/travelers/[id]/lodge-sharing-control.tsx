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
    <section className="lodge-panel mt-6 p-6">
      <p className="lodge-kicker">Choose the company</p>
      <h2 className="font-display text-text-primary mt-2 text-xl">Lodge Sharing</h2>

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
                className="lodge-list-row flex cursor-pointer items-center gap-3 p-3"
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
            className="lodge-button mt-2 self-start px-5 py-2.5 font-medium disabled:opacity-60"
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
