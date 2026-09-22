'use client';
import { useActionState } from 'react';
import {
  updateGuildCharacterSharing,
  type GuildSharingState,
} from '@/app/(app)/guild-hall/actions';
const initialState: GuildSharingState = { error: null, success: null };
export function GuildCharacterSharingControl({
  guildId,
  characterId,
  visibility,
}: {
  guildId: string;
  characterId: string;
  visibility?: 'leadership' | 'members';
}) {
  const [state, action, pending] = useActionState(updateGuildCharacterSharing, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="guildId" value={guildId} />
      <input type="hidden" name="characterId" value={characterId} />
      <select
        name="visibility"
        defaultValue={visibility ?? 'off'}
        disabled={pending}
        className="lodge-field px-2 py-1 text-sm"
      >
        <option value="off">Not shared</option>
        <option value="leadership">Guild leadership</option>
        <option value="members">All Guild members</option>
      </select>
      <button disabled={pending} className="lodge-button-secondary px-3 py-1 text-sm">
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
