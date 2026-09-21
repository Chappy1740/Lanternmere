'use client';

import { useActionState } from 'react';
import {
  createEventTemplate,
  deleteEventTemplate,
  type EventTemplateState,
} from '@/app/(app)/(lodge)/adventures/actions';

const initialState: EventTemplateState = { error: null, success: null };

export function EventTemplateForm({ lodgeId }: { lodgeId: string }) {
  const [state, formAction, isPending] = useActionState(createEventTemplate, initialState);
  return (
    <form action={formAction} className="lodge-panel p-6 sm:p-8">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          Recurring plan name
          <input
            name="title"
            required
            maxLength={120}
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Every
          <select name="weekday" defaultValue="2" className="lodge-field px-3 py-2 font-normal">
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Time <span className="text-text-muted font-normal">optional; shown in UTC</span>
          <input name="eventTime" type="time" className="lodge-field px-3 py-2 font-normal" />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Activity type
          <input
            name="activityType"
            maxLength={80}
            placeholder="Raid, Mythic+, PvP…"
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Difficulty
          <input
            name="difficulty"
            maxLength={80}
            placeholder="Heroic, casual, progression…"
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium sm:col-span-2">
          Preparation notes <span className="text-text-muted font-normal">optional</span>
          <textarea
            name="notes"
            rows={4}
            maxLength={2000}
            className="lodge-field resize-y px-3 py-2 font-normal"
          />
        </label>
      </div>
      <p className="text-text-muted mt-4 text-sm">
        This saves a reusable plan. Choose a date when you post the actual Quest Board event.
      </p>
      {state.error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted mt-5 text-sm">
          {state.success}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="lodge-button mt-6 px-5 py-2.5 font-medium disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save recurring plan'}
      </button>
    </form>
  );
}

export function DeleteEventTemplateControl({ templateId }: { templateId: string }) {
  const [state, formAction, isPending] = useActionState(deleteEventTemplate, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="templateId" value={templateId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-sm text-red-400 underline underline-offset-4 disabled:opacity-60"
      >
        {isPending ? 'Removing…' : 'Remove plan'}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
