'use client';
import { useActionState } from 'react';
import { updateGuildIdentity, type GuildIdentityState } from '@/app/(app)/guild-hall/actions';
const initial: GuildIdentityState = { error: null, success: null };
export function GuildIdentityForm({
  guildId,
  name,
  description,
}: {
  guildId: string;
  name: string;
  description: string | null;
}) {
  const [state, action, pending] = useActionState(updateGuildIdentity, initial);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="guildId" value={guildId} />
      <label className="block text-sm font-medium">
        Guild name
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={name}
          className="border-border bg-background mt-1 block w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Description
        <textarea
          name="description"
          maxLength={1000}
          defaultValue={description ?? ''}
          className="border-border bg-background mt-1 block min-h-20 w-full rounded-md border p-3"
        />
      </label>
      <button
        disabled={pending}
        className="lodge-button-secondary px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save Guild identity'}
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
    </form>
  );
}
