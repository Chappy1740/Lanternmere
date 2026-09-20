'use client';

import { useActionState } from 'react';
import {
  deleteAchievement,
  type AchievementState,
} from '@/app/(app)/(lodge)/hall-of-legends/actions';

const initialState: AchievementState = { error: null, success: null };

export function DeleteAchievementControl({ achievementId }: { achievementId: string }) {
  const [state, formAction, isPending] = useActionState(deleteAchievement, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="achievementId" value={achievementId} />
      <button
        type="submit"
        disabled={isPending}
        className="border border-red-400 px-4 py-2 text-sm text-red-400 disabled:opacity-60"
      >
        {isPending ? 'Removing…' : 'Remove achievement'}
      </button>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-text-muted mt-3 text-sm">
          {state.success}
        </p>
      )}
    </form>
  );
}
