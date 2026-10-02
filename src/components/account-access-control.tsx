'use client';
import { useActionState } from 'react';
import { setAccountAccess } from '@/app/(app)/owner/accounts/actions';
export function AccountAccessControl({
  profileId,
  suspended,
}: {
  profileId: string;
  suspended: boolean;
}) {
  const [state, action, pending] = useActionState(setAccountAccess, { error: null, success: null });
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="action" value={suspended ? 'restore' : 'suspend'} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" required /> Confirm{' '}
        {suspended ? 'restoring' : 'suspending'} this account
      </label>
      <button disabled={pending} className="lodge-button-secondary px-3 py-2 text-sm">
        {pending ? 'Saving…' : suspended ? 'Restore access' : 'Suspend access'}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
