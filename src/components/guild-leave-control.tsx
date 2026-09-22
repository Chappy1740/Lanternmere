'use client';

import { useActionState } from 'react';
import { leaveGuild, type GuildDepartureState } from '@/app/(app)/guild-hall/actions';

const initialState: GuildDepartureState = { error: null, success: null };

export function GuildLeaveControl({
  guildId,
  isGuildMaster,
}: {
  guildId: string;
  isGuildMaster: boolean;
}) {
  const [state, action, pending] = useActionState(leaveGuild, initialState);
  if (isGuildMaster)
    return (
      <p className="text-text-muted mt-3 text-sm">
        Transfer Guild Master ownership before you can leave this Guild.
      </p>
    );
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="guildId" value={guildId} />
      <button
        disabled={pending}
        className="lodge-button-secondary px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? 'Leaving…' : 'Leave Guild'}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
