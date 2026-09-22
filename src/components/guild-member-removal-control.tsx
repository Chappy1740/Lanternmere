'use client';
import { useActionState } from 'react';
import { removeGuildMember, type GuildDepartureState } from '@/app/(app)/guild-hall/actions';
const initialState: GuildDepartureState = { error: null, success: null };
export function GuildMemberRemovalControl({ membershipId }: { membershipId: string }) {
  const [state, action, pending] = useActionState(removeGuildMember, initialState);
  return (
    <form action={action}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <button disabled={pending} className="text-sm text-red-400 underline disabled:opacity-60">
        {pending ? 'Removing…' : 'Remove member'}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted text-xs">
          {state.success}
        </p>
      )}
    </form>
  );
}
