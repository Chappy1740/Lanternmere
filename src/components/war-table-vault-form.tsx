'use client';

import { useActionState } from 'react';
import { saveVaultProgress, type VaultState } from '@/app/(app)/war-table/actions';

type VaultProgress = {
  raid_progress: string;
  dungeon_progress: string;
  world_progress: string;
  notes: string;
  updated_at: string;
};

export function WarTableVaultForm({
  characterId,
  resetOn,
  progress,
}: {
  characterId: string;
  resetOn: string;
  progress: VaultProgress | null;
}) {
  const [state, action, pending] = useActionState<VaultState, FormData>(saveVaultProgress, {
    message: '',
    error: false,
  });
  return (
    <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="characterId" value={characterId} />
      <input type="hidden" name="resetOn" value={resetOn} />
      <label className="text-text-muted grid gap-1 text-sm">
        Raid progress
        <input
          name="raidProgress"
          maxLength={160}
          defaultValue={progress?.raid_progress ?? ''}
          className="lodge-field px-3 py-2"
          placeholder="Your own note about raid slots"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Dungeon progress
        <input
          name="dungeonProgress"
          maxLength={160}
          defaultValue={progress?.dungeon_progress ?? ''}
          className="lodge-field px-3 py-2"
          placeholder="Your own note about dungeon slots"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        World progress
        <input
          name="worldProgress"
          maxLength={160}
          defaultValue={progress?.world_progress ?? ''}
          className="lodge-field px-3 py-2"
          placeholder="Your own note about world slots"
        />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Notes
        <textarea
          name="notes"
          maxLength={500}
          defaultValue={progress?.notes ?? ''}
          className="lodge-field min-h-20 px-3 py-2"
          placeholder="Optional goals or reminders"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="lodge-button px-4 py-2 font-medium" disabled={pending}>
          {pending ? 'Saving…' : 'Save Vault context'}
        </button>
        {state.message && (
          <p
            role="status"
            className={state.error ? 'text-sm text-amber-200' : 'text-text-muted text-sm'}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
