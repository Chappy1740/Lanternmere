'use client';
import { useActionState } from 'react';
import {
  acceptGuildInvitation,
  type GuildInvitationAcceptanceState,
} from '@/app/guild-invitations/[token]/actions';
const initialState: GuildInvitationAcceptanceState = { error: null };
export function AcceptGuildInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptGuildInvitation, initialState);
  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <button
        disabled={pending}
        className="lodge-button px-5 py-2.5 font-medium disabled:opacity-60"
      >
        {pending ? 'Joining…' : 'Join this Guild'}
      </button>
      {state.error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
