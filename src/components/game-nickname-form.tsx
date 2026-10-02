'use client';
import { useActionState } from 'react';
import { updateGameNickname } from '@/app/(app)/account/actions';
export function GameNicknameForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useActionState(updateGameNickname, {
    error: null,
    success: null,
  });
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block">
        Game nickname
        <input
          name="nickname"
          required
          minLength={2}
          maxLength={32}
          defaultValue={nickname}
          autoComplete="nickname"
          className="lodge-field mt-2 block px-3 py-2"
        />
      </label>
      <p className="text-text-muted text-sm">
        Choose a game nickname, not your real name or email. Sharing it with the app owner is
        optional in Membership.
      </p>
      <button disabled={pending} className="lodge-button px-4 py-2">
        {pending ? 'Saving…' : 'Save nickname'}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
