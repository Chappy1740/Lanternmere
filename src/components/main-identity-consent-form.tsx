'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  acknowledgeMainIdentity,
  type MainIdentityConsentState,
} from '@/app/(app)/membership/actions';

const initialState: MainIdentityConsentState = { error: null, success: null };

export function MainIdentityConsentForm({ acknowledged }: { acknowledged: boolean }) {
  const [state, action, pending] = useActionState(acknowledgeMainIdentity, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);
  if (acknowledged || state.success)
    return (
      <p role="status" className="text-green-300">
        Main identity sharing acknowledged.
      </p>
    );
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="acknowledgeMainIdentity"
          value="yes"
          required
          className="mt-1"
        />
        <span>
          I understand that the app owner will see my selected, Battle.net-verified Main’s name,
          realm, and region. My sign-in email, alternate characters, private character list, gear,
          and notes are not included in that owner view. This is required before I add a Traveler.
        </span>
      </label>
      <button type="submit" disabled={pending} className="lodge-button px-4 py-2">
        {pending ? 'Saving…' : 'Acknowledge Main identity sharing'}
      </button>
      {state.error && (
        <p role="alert" className="text-red-300">
          {state.error}
        </p>
      )}
    </form>
  );
}
