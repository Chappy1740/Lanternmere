'use client';

import { Suspense, useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { resendConfirmation, signIn, type AuthActionState } from '../actions';

const initialState: AuthActionState = { error: null };

function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [confirmationState, confirmationAction, isResending] = useActionState(
    resendConfirmation,
    initialState,
  );
  const params = useSearchParams();
  const next = params.get('next');
  const returnTo =
    next && /^\/(?:invitations|guild-invitations)\/[A-Za-z0-9_-]{32,128}$/.test(next) ? next : '';

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
          <Image
            src="/brand/lanternmere-master-crest.png"
            alt=""
            width={48}
            height={48}
            className="h-11 w-11 rounded-full border border-[color:var(--border-ornate)]"
          />
          <div>
            <p className="lodge-kicker">The Lodge awaits</p>
            <h1 className="font-display text-accent mt-1 text-2xl font-bold">Lanternmere</h1>
          </div>
        </div>
        <p className="text-text-muted mt-5 text-sm">Welcome back, Traveler.</p>
        {params.get('confirmEmail') === '1' && (
          <section
            role="status"
            className="border-accent bg-background/80 mt-5 rounded-lg border p-4"
          >
            <h2 className="text-accent text-lg font-bold">Check your email or sign in</h2>
            <p className="text-text-primary mt-2 text-sm">
              If this is a new account, you should receive a confirmation email. Open it and click
              “Confirm email address” before signing in.
            </p>
            <p className="text-text-muted mt-2 text-sm">
              This email may already be in use. If it belongs to an existing account, no new account
              was created; sign in below instead. For a new account, allow a few minutes and check
              your spam or junk folder.
            </p>
          </section>
        )}
        {params.get('confirmationError') === '1' && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {params.get('confirmationExpired') === '1'
              ? 'This confirmation link has expired or is no longer valid. Request a new email below and use its newest link.'
              : 'This confirmation link could not be completed. It may have expired, already been used, or been opened in a different browser. If your email is already confirmed, sign in. Otherwise request a new email below.'}
          </p>
        )}

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
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

          <Link
            href="/forgot-password"
            className="text-accent hover:text-accent-hover -mt-1 text-right text-sm"
          >
            Forgot password?
          </Link>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-text-primary text-sm">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
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
            {isPending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <section
          aria-labelledby="resend-heading"
          className="mt-6 border-t border-[color:var(--border-ornate)] pt-5"
        >
          <h2 id="resend-heading" className="text-text-primary font-semibold">
            Need a new confirmation email?
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Enter your signup email, then open the newest confirmation link in this browser.
          </p>
          <form action={confirmationAction} className="mt-3 flex flex-col gap-3">
            <label htmlFor="confirmation-email" className="text-text-primary text-sm">
              Signup email
            </label>
            <input
              id="confirmation-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className="lodge-field px-3 py-2"
            />
            {confirmationState.error && (
              <p role="alert" className="text-sm text-red-400">
                {confirmationState.error}
              </p>
            )}
            {confirmationState.success && (
              <p role="status" className="text-text-primary text-sm">
                {confirmationState.success}
              </p>
            )}
            <button
              type="submit"
              disabled={isResending}
              className="lodge-button px-4 py-2 font-medium disabled:opacity-60"
            >
              {isResending ? 'Requesting email…' : 'Resend confirmation email'}
            </button>
          </form>
        </section>

        <p className="text-text-muted mt-6 text-center text-sm">
          New to Lanternmere?{' '}
          <Link
            href={returnTo ? `/sign-up?next=${encodeURIComponent(returnTo)}` : '/sign-up'}
            className="text-accent hover:text-accent-hover"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
