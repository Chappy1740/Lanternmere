'use client';

import { useActionState } from 'react';
import { createLodge, type CreateLodgeState } from './actions';

const initialState: CreateLodgeState = {
  error: null,
};

export default function NewLodgePage() {
  const [state, formAction, isPending] = useActionState(createLodge, initialState);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-text-primary text-3xl font-bold">Create a Lodge</h1>

      <p className="text-text-muted mt-2">Every gathering needs a place to call home.</p>

      <form action={formAction} className="mt-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-text-primary text-sm font-medium">
            Lodge name
          </label>

          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={80}
            placeholder="The Forgotten Lodge"
            className="border-border bg-background text-text-primary focus-visible:outline-accent rounded-md border px-3 py-2 focus-visible:outline-2"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="text-text-primary text-sm font-medium">
            Description
          </label>

          <textarea
            id="description"
            name="description"
            rows={4}
            maxLength={500}
            placeholder="A place where weary travelers come to forget the troubles of their day."
            className="border-border bg-background text-text-primary focus-visible:outline-accent rounded-md border px-3 py-2 focus-visible:outline-2"
          />
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-red-400">
            {state.error}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="bg-accent text-background hover:bg-accent-hover rounded-md px-5 py-2.5 font-medium transition-colors disabled:opacity-60"
          >
            {isPending ? 'Creating Lodge…' : 'Create Lodge'}
          </button>
        </div>
      </form>
    </div>
  );
}
