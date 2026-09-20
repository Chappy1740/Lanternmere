'use client';

import { useActionState } from 'react';
import {
  acceptLodgeInvitation,
  type InvitationAcceptanceState,
} from '@/app/invitations/[token]/actions';

const initialState: InvitationAcceptanceState = { error: null };

export function AcceptLodgeInvitationForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(acceptLodgeInvitation, initialState);
  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={isPending}
        className="lodge-button px-5 py-2.5 font-medium disabled:opacity-60"
      >
        {isPending ? 'Joining…' : 'Join this Lodge'}
      </button>
      {state.error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
