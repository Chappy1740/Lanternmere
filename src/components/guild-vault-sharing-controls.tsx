'use client';

import { useActionState } from 'react';
import { setGuildVaultSharing, type VaultShareState } from '@/app/(app)/war-table/actions';

export function GuildVaultSharingControls({
  progressId,
  guilds,
  sharedGuildIds,
}: {
  progressId: string;
  guilds: { id: string; name: string }[];
  sharedGuildIds: string[];
}) {
  const [state, action, pending] = useActionState<VaultShareState, FormData>(setGuildVaultSharing, {
    message: '',
    error: false,
  });
  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <h3 className="font-display text-text-primary text-lg font-bold">
        Share with Guild leadership
      </h3>
      <p className="text-text-muted mt-2 text-sm">
        Choose each Guild separately. Only its verified leaders can read this week’s player-entered
        context. You can revoke access here.
      </p>
      <div className="mt-3 grid gap-2">
        {guilds.map((guild) => {
          const shared = sharedGuildIds.includes(guild.id);
          return (
            <form
              key={guild.id}
              action={action}
              className="lodge-list-row flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
            >
              <span className="text-text-primary">
                {guild.name} · {shared ? 'Shared' : 'Private'}
              </span>
              <input type="hidden" name="progressId" value={progressId} />
              <input type="hidden" name="guildId" value={guild.id} />
              <input type="hidden" name="enabled" value={shared ? 'false' : 'true'} />
              <button disabled={pending} className="lodge-button-secondary px-3 py-1.5">
                {shared ? 'Revoke' : 'Share'}
              </button>
            </form>
          );
        })}
      </div>
      {state.message && (
        <p
          role="status"
          className={state.error ? 'mt-3 text-sm text-amber-200' : 'text-text-muted mt-3 text-sm'}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
