'use client';

import { useActionState } from 'react';
import type { Chronicle } from '@/lib/chronicles';
import type { ChronicleState } from '@/app/(app)/(lodge)/chronicles/actions';

const initialState: ChronicleState = { error: null, success: null };
type ChronicleAction = (state: ChronicleState, formData: FormData) => Promise<ChronicleState>;

export function ChronicleForm({
  action,
  lodgeId,
  entry,
}: {
  action: ChronicleAction;
  lodgeId: string;
  entry?: Chronicle;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="lodge-panel p-6 sm:p-8">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      {entry && <input type="hidden" name="chronicleId" value={entry.id} />}
      <div className="grid gap-6">
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Chronicle title
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={entry?.title ?? ''}
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          The story
          <textarea
            name="body"
            required
            rows={12}
            maxLength={5_000}
            defaultValue={entry?.body ?? ''}
            className="lodge-field resize-y px-3 py-2 font-normal"
          />
          <span className="text-text-muted text-xs font-normal">
            Shared with members of this Lodge.
          </span>
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Screenshot or image (optional)
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="lodge-field px-3 py-2 font-normal"
          />
          <span className="text-text-muted text-xs font-normal">
            JPG, PNG, or WebP, up to 5 MB. It stays private to Lodge members.
          </span>
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Image caption (optional)
          <input name="caption" maxLength={500} className="lodge-field px-3 py-2 font-normal" />
        </label>
      </div>
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
        {isPending ? 'Saving…' : entry ? 'Save Chronicle' : 'Record Chronicle'}
      </button>
    </form>
  );
}
