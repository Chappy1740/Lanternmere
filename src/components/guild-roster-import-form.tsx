'use client';
import { useActionState } from 'react';
import {
  importOfficialGuildRoster,
  type GuildRosterImportState,
} from '@/app/(app)/guild-hall/actions';
const initialState: GuildRosterImportState = { error: null, success: null };
export function GuildRosterImportForm({ guildId }: { guildId: string }) {
  const [state, action, pending] = useActionState(importOfficialGuildRoster, initialState);
  return (
    <form action={action} className="mt-5 grid gap-3">
      <input type="hidden" name="guildId" value={guildId} />
      <label className="text-sm">
        Region
        <select name="region" defaultValue="us" className="lodge-field ml-3 px-2 py-1">
          <option value="us">US</option>
          <option value="eu">EU</option>
          <option value="kr">KR</option>
          <option value="tw">TW</option>
        </select>
      </label>
      <input name="realm" required placeholder="Realm" className="lodge-field px-3 py-2" />
      <input
        name="guildName"
        required
        placeholder="Official Guild name"
        className="lodge-field px-3 py-2"
      />
      <button disabled={pending} className="lodge-button w-fit px-4 py-2 text-sm">
        {pending ? 'Importing…' : 'Import official roster'}
      </button>
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
    </form>
  );
}
