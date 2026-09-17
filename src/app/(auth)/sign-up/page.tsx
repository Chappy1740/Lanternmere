'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signUp, type AuthActionState } from '../actions';

const initialState: AuthActionState = { error: null };

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-surface w-full max-w-sm rounded-lg border p-8">
        <h1 className="font-display text-accent text-2xl font-bold">Lanternmere</h1>
        <p className="text-text-muted mt-1 text-sm">Where weary travelers arrive.</p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="displayName" className="text-text-primary text-sm">
              Display name <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="nickname"
              className="border-border bg-background text-text-primary focus-visible:outline-accent rounded-md border px-3 py-2 focus-visible:outline-2"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-text-primary text-sm">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="border-border bg-background text-text-primary focus-visible:outline-accent rounded-md border px-3 py-2 focus-visible:outline-2"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-text-primary text-sm">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="border-border bg-background text-text-primary focus-visible:outline-accent rounded-md border px-3 py-2 focus-visible:outline-2"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-text-primary text-sm">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              className="border-border bg-background text-text-primary focus-visible:outline-accent rounded-md border px-3 py-2 focus-visible:outline-2"
            />
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-red-400">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="bg-accent text-background hover:bg-accent-hover mt-2 rounded-md px-4 py-2 font-medium transition-colors disabled:opacity-60"
          >
            {isPending ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-text-muted mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
