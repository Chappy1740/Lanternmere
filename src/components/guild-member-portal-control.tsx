'use client';

import { useActionState } from 'react';
import {
  updateGuildMemberPortal,
  type GuildMemberPortalState,
} from '@/app/(app)/guild-hall/actions';

const initialState: GuildMemberPortalState = { error: null, success: null };

export function GuildMemberPortalControl({
  guildId,
  enabled,
}: {
  guildId: string;
  enabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateGuildMemberPortal, initialState);
  const nextEnabled = !enabled;
  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="enabled" value={String(nextEnabled)} />
      <button
        type="submit"
        disabled={isPending}
        className="lodge-button-secondary px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {isPending ? 'Saving…' : enabled ? 'Use leadership-only access' : 'Enable member portal'}
      </button>
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
    </form>
  );
}
