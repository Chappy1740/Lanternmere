'use client';

import { useActionState } from 'react';
import type { Achievement } from '@/lib/achievements';
import type { AchievementState } from '@/app/(app)/(lodge)/hall-of-legends/actions';

const initialState: AchievementState = { error: null, success: null };
type Action = (state: AchievementState, formData: FormData) => Promise<AchievementState>;
export type AchievementCharacterOption = { id: string; character_name: string; realm_slug: string };

export function AchievementForm({
  action,
  lodgeId,
  entry,
  characters,
}: {
  action: Action;
  lodgeId: string;
  entry?: Achievement;
  characters: AchievementCharacterOption[];
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const date = entry?.achieved_at?.slice(0, 10) ?? '';
  return (
    <form action={formAction} className="lodge-panel p-6 sm:p-8">
      <input type="hidden" name="lodgeId" value={lodgeId} />
      {entry && <input type="hidden" name="achievementId" value={entry.id} />}
      <div className="grid gap-6">
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Achievement title
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={entry?.title ?? ''}
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          When did this happen?
          <input
            name="achievedAt"
            type="date"
            defaultValue={date}
            className="lodge-field px-3 py-2 font-normal"
          />
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          Credit a Traveler (optional)
          <select
            name="characterId"
            defaultValue={entry?.character_id ?? ''}
            className="lodge-field px-3 py-2 font-normal"
          >
            <option value="">This is a Lodge milestone</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.character_name} · {character.realm_slug}
              </option>
            ))}
          </select>
          <span className="text-text-muted text-xs font-normal">
            You can credit one of your own Travelers, or celebrate the whole Lodge.
          </span>
        </label>
        <label className="text-text-primary flex flex-col gap-2 text-sm font-medium">
          The story (optional)
          <textarea
            name="description"
            rows={8}
            maxLength={2_000}
            defaultValue={entry?.description ?? ''}
            className="lodge-field resize-y px-3 py-2 font-normal"
          />
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
        {isPending ? 'Saving…' : entry ? 'Save achievement' : 'Record achievement'}
      </button>
    </form>
  );
}
