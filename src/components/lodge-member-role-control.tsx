'use client';

import { useActionState } from 'react';
import {
  updateLodgeMemberRole,
  type CaretakerState,
} from '@/app/(app)/(lodge)/caretakers-office/actions';

const initialState: CaretakerState = { error: null, success: null };

export function LodgeMemberRoleControl({
  membershipId,
  role,
}: {
  membershipId: string;
  role: 'caretaker' | 'member' | 'guest';
}) {
  const [state, formAction, isPending] = useActionState(updateLodgeMemberRole, initialState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <label className="sr-only" htmlFor={`role-${membershipId}`}>
        Lodge role
      </label>
      <select
        id={`role-${membershipId}`}
        name="role"
        defaultValue={role}
        disabled={isPending}
        className="lodge-field px-3 py-2 text-sm"
      >
        <option value="caretaker">Caretaker</option>
        <option value="member">Member</option>
        <option value="guest">Guest</option>
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="lodge-button-secondary px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save role'}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted w-full text-sm">
          {state.success}
        </p>
      )}
    </form>
  );
}
