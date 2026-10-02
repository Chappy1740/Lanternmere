'use client';

import { useActionState } from 'react';
import {
  updateDirectoryPreference,
  type DirectoryPreferenceState,
} from '@/app/(app)/membership/actions';

const initialState: DirectoryPreferenceState = { error: null, success: null };

export function AppDirectoryPreferenceForm({
  alias,
  visible,
}: {
  alias: string | null;
  visible: boolean;
}) {
  const [state, action, pending] = useActionState(updateDirectoryPreference, initialState);
  return (
    <form action={action} className="mt-5 space-y-4">
      <label className="text-text-primary flex max-w-sm flex-col gap-2 text-sm font-medium">
        Optional app-directory alias
        <input
          className="lodge-field px-3 py-2 font-normal"
          name="alias"
          defaultValue={alias ?? ''}
          maxLength={32}
          autoComplete="off"
          placeholder="Your game nickname"
        />
      </label>
      <p className="text-text-muted text-sm">
        Choose a nickname, not your real name or email. It is shown only to the application owner if
        you opt in; otherwise the owner sees a numbered member.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="visible"
          value="true"
          disabled={pending}
          className="lodge-button px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending ? 'Saving…' : visible ? 'Update visible alias' : 'Show my alias to owner'}
        </button>
        <button
          type="submit"
          name="visible"
          value="false"
          disabled={pending}
          className="lodge-button-secondary px-4 py-2 text-sm disabled:opacity-60"
        >
          Hide my alias
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-accent text-sm">
          {state.success}
        </p>
      )}
    </form>
  );
}
