'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { updatePassword, type AuthActionState } from '../actions';

const initialState: AuthActionState = { error: null, success: null };

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(updatePassword, initialState);
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <Image
        src="/brand/lanternmere-lodge-hero-v1.png"
        alt=""
        fill
        priority
        className="object-cover object-[68%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,11,18,0.92),rgba(5,11,18,0.72)_48%,rgba(5,11,18,0.3)),linear-gradient(0deg,rgba(5,11,18,0.7),transparent)]" />
      <section className="lodge-panel relative w-full max-w-sm p-7 sm:p-8">
        <Image
          src="/brand/lanternmere-master-crest.png"
          alt=""
          width={48}
          height={48}
          className="h-11 w-11 rounded-full border border-[color:var(--border-ornate)]"
        />
        <p className="lodge-kicker mt-5">A new beginning</p>
        <h1 className="font-display text-accent mt-1 text-2xl font-bold">Choose a new password</h1>
        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <label htmlFor="password" className="text-text-primary flex flex-col gap-1 text-sm">
            New password
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="lodge-field px-3 py-2"
            />
          </label>
          <label
            htmlFor="confirmPassword"
            className="text-text-primary flex flex-col gap-1 text-sm"
          >
            Confirm password
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="lodge-field px-3 py-2"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-sm text-red-400">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="text-text-muted text-sm">
              {state.success}{' '}
              <Link href="/sign-in" className="text-accent hover:text-accent-hover">
                Sign in
              </Link>
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="lodge-button mt-2 px-4 py-2 font-medium disabled:opacity-60"
          >
            {isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>
    </main>
  );
}
