'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { signUp, type AuthActionState } from '../actions';

const initialState: AuthActionState = { error: null };

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <Image
        src="/brand/lanternmere-lodge-hero-v1.png"
        alt=""
        fill
        priority
        className="object-cover object-[68%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,11,18,0.92),rgba(5,11,18,0.72)_48%,rgba(5,11,18,0.3)),linear-gradient(0deg,rgba(5,11,18,0.7),transparent)]" />
      <div className="lodge-panel relative w-full max-w-sm p-7 sm:p-8">
        <div className="flex items-center gap-3">
          <Image src="/brand/lanternmere-master-crest.png" alt="" width={48} height={48} className="h-11 w-11 rounded-full border border-[color:var(--border-ornate)]" />
          <div>
            <p className="lodge-kicker">Begin your story</p>
            <h1 className="font-display text-accent mt-1 text-2xl font-bold">Lanternmere</h1>
          </div>
        </div>
        <p className="text-text-muted mt-5 text-sm">Where weary travelers arrive.</p>

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
              className="lodge-field px-3 py-2"
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
              className="lodge-field px-3 py-2"
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
              className="lodge-field px-3 py-2"
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
              className="lodge-field px-3 py-2"
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
            className="lodge-button mt-2 px-4 py-2 font-medium disabled:opacity-60"
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
