'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signUp, type AuthActionState } from '../actions';

const initialState: AuthActionState = { error: null };

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8">
        <h1 className="font-display text-2xl font-bold text-accent">Lanternmere</h1>
        <p className="mt-1 text-sm text-text-muted">Where weary travelers arrive.</p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="displayName" className="text-sm text-text-primary">
              Display name <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="nickname"
              className="rounded-md border border-border bg-background px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-text-primary">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-border bg-background px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-text-primary">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="rounded-md border border-border bg-background px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-sm text-text-primary">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              className="rounded-md border border-border bg-background px-3 py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-red-400">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 rounded-md bg-accent px-4 py-2 font-medium text-background transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}