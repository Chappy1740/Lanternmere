'use client';
import { useActionState } from 'react';
import { createGuildInvitation, type GuildInvitationState } from '@/app/(app)/guild-hall/actions';
const initialState: GuildInvitationState = { error: null, success: null };
export function GuildInvitationForm({ guildId }: { guildId: string }) {
  const [state, action, pending] = useActionState(createGuildInvitation, initialState);
  const url =
    state.invitationPath && typeof window !== 'undefined'
      ? `${window.location.origin}${state.invitationPath}`
      : null;
  return (
    <form action={action} className="mt-5 grid gap-3">
      <input type="hidden" name="guildId" value={guildId} />
      <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
        Recipient email <span className="text-text-muted font-normal">(optional)</span>
        <input
          name="email"
          type="email"
          maxLength={320}
          className="lodge-field px-3 py-2 font-normal"
        />
      </label>
      <button
        disabled={pending}
        className="lodge-button w-fit px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? 'Creating…' : 'Create invitation'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted text-sm">
          {state.success}
        </p>
      )}
      {url && <input value={url} readOnly className="lodge-field px-3 py-2 text-sm" />}
    </form>
  );
}
