'use client';

import { useActionState } from 'react';
import {
  revokeLodgeInvitation,
  type CaretakerState,
} from '@/app/(app)/(lodge)/caretakers-office/actions';

const initialState: CaretakerState = { error: null, success: null };

export function RevokeLodgeInvitationControl({ invitationId }: { invitationId: string }) {
  const [state, formAction, isPending] = useActionState(revokeLodgeInvitation, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={isPending}
        className="border border-red-400 px-3 py-2 text-sm text-red-400 disabled:opacity-60"
      >
        {isPending ? 'Revoking…' : 'Revoke'}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted mt-2 text-sm">
          {state.success}
        </p>
      )}
    </form>
  );
}
