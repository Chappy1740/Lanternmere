'use client';
import { useActionState } from 'react';
import { refreshRaiderIo, updateRaiderIoSharing, type CharacterStatusState } from './actions';
const initialState: CharacterStatusState = { error: null, success: null };
export function RaiderIoSharingControl({
  characterId,
  lodges,
  selected,
  refreshedAt,
  sourceUrl,
}: {
  characterId: string;
  lodges: { id: string; name: string }[];
  selected: string[];
  refreshedAt: string | null;
  sourceUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateRaiderIoSharing, initialState);
  const [refreshState, refreshAction, refreshPending] = useActionState(refreshRaiderIo, initialState);
  return (
    <section className="lodge-panel mt-6 p-6">
      <p className="lodge-kicker">Optional readiness sharing</p>
      <h2 className="font-display text-text-primary mt-2 text-xl">Raider.IO progress</h2>
      <p className="text-text-muted mt-2 text-sm">
        Share public Raider.IO progress with a selected Lodge. You can revoke it here at any time.
      </p>
      <form action={refreshAction} className="mt-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="characterId" value={characterId} />
        <button className="lodge-button-secondary px-3 py-2 text-sm" disabled={refreshPending}>
          {refreshPending ? 'Refreshing…' : 'Refresh from Raider.IO'}
        </button>
        {refreshedAt && (
          <span className="text-text-muted text-sm">
            Last checked {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(refreshedAt))} UTC
          </span>
        )}
        {sourceUrl && (
          <a className="text-accent text-sm underline underline-offset-4" href={sourceUrl} target="_blank" rel="noreferrer">
            View on Raider.IO
          </a>
        )}
      </form>
      {refreshState.error && <p role="alert" className="mt-3 text-sm text-red-400">{refreshState.error}</p>}
      {refreshState.success && <p role="status" className="text-text-muted mt-3 text-sm">{refreshState.success}</p>}
      <div className="mt-4 space-y-3">
        {lodges.map((lodge) => (
          <form key={lodge.id} action={action} className="flex items-center justify-between gap-3">
            <input type="hidden" name="characterId" value={characterId} />
            <input type="hidden" name="lodgeId" value={lodge.id} />
            <input
              type="hidden"
              name="enabled"
              value={selected.includes(lodge.id) ? 'false' : 'true'}
            />
            <span className="text-text-primary text-sm">{lodge.name}</span>
            <button className="lodge-button-secondary px-3 py-2 text-sm" disabled={pending}>
              {selected.includes(lodge.id) ? 'Stop sharing' : 'Share readiness'}
            </button>
          </form>
        ))}
      </div>
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
    </section>
  );
}
