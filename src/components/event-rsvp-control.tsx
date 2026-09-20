'use client';

import { useActionState } from 'react';
import { updateRsvp, type QuestBoardState } from '@/app/(app)/(lodge)/quest-board/actions';

const initialState: QuestBoardState = { error: null, success: null };

export function EventRsvpControl({
  eventId,
  currentStatus,
  currentRole,
  currentCharacterId,
  characters,
}: {
  eventId: string;
  currentStatus?: string;
  currentRole?: string | null;
  currentCharacterId?: string | null;
  characters: { id: string; character_name: string; realm_slug: string }[];
}) {
  const [state, formAction, isPending] = useActionState(updateRsvp, initialState);
  return (
    <form action={formAction} className="lodge-panel p-6">
      <input type="hidden" name="eventId" value={eventId} />
      <fieldset disabled={isPending}>
        <legend className="flex flex-col gap-2">
          <span className="lodge-kicker">Answer the call</span>
          <span className="font-display text-text-primary text-xl">Your attendance</span>
        </legend>
        <p className="text-text-muted mt-2 text-sm">Let the Lodge know whether you can make it.</p>
        <label className="text-text-primary mt-4 flex flex-col gap-2 text-sm font-medium">
          RSVP status
          <select
            name="status"
            defaultValue={currentStatus ?? 'tentative'}
            className="lodge-field px-3 py-2 font-normal"
          >
            <option value="confirmed">Confirmed</option>
            <option value="tentative">Tentative</option>
            <option value="declined">Declined</option>
          </select>
        </label>
        <label className="text-text-primary mt-4 flex flex-col gap-2 text-sm font-medium">
          Preferred group role
          <select
            name="role"
            defaultValue={currentRole ?? ''}
            className="lodge-field px-3 py-2 font-normal"
          >
            <option value="">No preference yet</option>
            <option value="tank">Tank</option>
            <option value="healer">Healer</option>
            <option value="damage">Damage</option>
            <option value="support">Support</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
        <label className="text-text-primary mt-4 flex flex-col gap-2 text-sm font-medium">
          Traveler (optional)
          <select
            name="characterId"
            defaultValue={currentCharacterId ?? ''}
            className="lodge-field px-3 py-2 font-normal"
          >
            <option value="">Choose later</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.character_name} · {character.realm_slug}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="lodge-button mt-5 px-5 py-2.5 font-medium disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save RSVP'}
        </button>
      </fieldset>
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
