'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { requestPasswordReset, type AuthActionState } from '../actions';

const initialState: AuthActionState = { error: null, success: null };

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);
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
        <p className="lodge-kicker mt-5">Find your way back</p>
        <h1 className="font-display text-accent mt-1 text-2xl font-bold">Reset your password</h1>
        <p className="text-text-muted mt-4 text-sm">
          Enter your account email and we&apos;ll send a secure reset link if it exists.
        </p>
        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <label htmlFor="email" className="text-text-primary flex flex-col gap-1 text-sm">
            Email
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
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
              {state.success}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="lodge-button mt-2 px-4 py-2 font-medium disabled:opacity-60"
          >
            {isPending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="text-text-muted mt-6 text-center text-sm">
          <Link href="/sign-in" className="text-accent hover:text-accent-hover">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
