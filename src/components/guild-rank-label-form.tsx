'use client';

import { useActionState } from 'react';
import { saveGuildRankLabel, type GuildMemberPortalState } from '@/app/(app)/guild-hall/actions';

const initialState: GuildMemberPortalState = { error: null, success: null };

export function GuildRankLabelForm({
  guildId,
  rank,
  label,
}: {
  guildId: string;
  rank: number;
  label?: string;
}) {
  const [state, action, pending] = useActionState(saveGuildRankLabel, initialState);

  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="rank" value={rank} />
      <label className="sr-only" htmlFor={`guild-rank-label-${guildId}-${rank}`}>
        Label for Guild rank {rank}
      </label>
      <input
        id={`guild-rank-label-${guildId}-${rank}`}
        name="label"
        defaultValue={label ?? `Rank ${rank}`}
        className="lodge-field w-40 px-2 py-1 text-sm"
        aria-invalid={Boolean(state.error)}
      />
      <button disabled={pending} className="lodge-button-secondary px-2 text-sm">
        Save
      </button>
      {state.error && (
        <span role="alert" className="text-xs text-red-400">
          {state.error}
        </span>
      )}
      {state.success && (
        <span role="status" className="text-xs text-green-400">
          {state.success}
        </span>
      )}
    </form>
  );
}
