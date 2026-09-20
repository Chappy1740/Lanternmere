'use client';

import { useActionState } from 'react';
import {
  createLodgeInvitation,
  type CaretakerState,
} from '@/app/(app)/(lodge)/caretakers-office/actions';

const initialState: CaretakerState = { error: null, success: null };

export function LodgeInvitationForm({
  lodgeId,
  lodgeName,
}: {
  lodgeId: string;
  lodgeName: string;
}) {
  const [state, formAction, isPending] = useActionState(createLodgeInvitation, initialState);
  const invitationUrl = state.invitationPath
    ? `${typeof window === 'undefined' ? '' : window.location.origin}${state.invitationPath}`
    : null;
  const mailto = invitationUrl
    ? `mailto:${encodeURIComponent(state.email ?? '')}?subject=${encodeURIComponent(`Join ${lodgeName} on Lanternmere`)}&body=${encodeURIComponent(`You are invited to join ${lodgeName} on Lanternmere.\n\n${invitationUrl}\n\nThis invitation expires in seven days.`)}`
    : null;

  return (
    <section className="lodge-panel p-6 sm:p-8" aria-labelledby="invite-heading">
      <p className="lodge-kicker">Welcome a Traveler</p>
      <h2 id="invite-heading" className="font-display text-text-primary mt-2 text-2xl font-bold">
        Create an invitation
      </h2>
      <p className="text-text-muted mt-3 text-sm leading-6">
        Leave the email blank for a shareable link. Adding an email locks redemption to that
        Lanternmere account and prepares a message in your usual mail app.
      </p>
      <form action={formAction} className="mt-6 grid gap-5">
        <input type="hidden" name="lodgeId" value={lodgeId} />
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Recipient email <span className="text-text-muted font-normal">(optional)</span>
          <input
            name="email"
            type="email"
            maxLength={320}
            autoComplete="email"
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Lodge role
          <select name="role" defaultValue="member" className="lodge-field px-3 py-2 font-normal">
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="lodge-button w-fit px-5 py-2.5 font-medium disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create invitation'}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted mt-4 text-sm">
          {state.success}
        </p>
      )}
      {invitationUrl && (
        <div className="bg-surface-sunken/45 mt-5 grid gap-3 rounded-lg border border-[color:var(--border-ornate)] p-4">
          <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
            Invitation link
            <input value={invitationUrl} readOnly className="lodge-field px-3 py-2 font-normal" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(invitationUrl)}
              className="lodge-button-secondary px-4 py-2 text-sm font-medium"
            >
              Copy link
            </button>
            {mailto && (
              <a href={mailto} className="lodge-button-secondary px-4 py-2 text-sm font-medium">
                Open email draft
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
