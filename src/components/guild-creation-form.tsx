'use client';

import { useActionState } from 'react';
import { createGuild, type GuildCreationState } from '@/app/(app)/guild-hall/actions';

const initialState: GuildCreationState = { error: null };

export function GuildCreationForm() {
  const [state, formAction, isPending] = useActionState(createGuild, initialState);
  return (
    <form action={formAction} className="mt-6 grid gap-5">
      <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
        Guild name
        <input name="name" maxLength={60} required className="lodge-field px-3 py-2 font-normal" />
      </label>
      <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
        Description <span className="text-text-muted font-normal">(optional)</span>
        <textarea
          name="description"
          maxLength={1000}
          rows={3}
          className="lodge-field resize-y px-3 py-2 font-normal"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="lodge-button w-fit px-5 py-2.5 font-medium disabled:opacity-60"
      >
        {isPending ? 'Establishing…' : 'Establish Guild'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
