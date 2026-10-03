'use client';

import { useActionState } from 'react';
import {
  createAvailability,
  deleteAvailability,
  type AvailabilityState,
} from '@/app/(app)/war-table/actions';

const initialState: AvailabilityState = { message: '', error: false };

export function AvailabilityForm({ guilds }: { guilds: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createAvailability, initialState);
  return (
    <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-text-muted grid gap-1 text-sm">
        Guild
        <select name="guildId" required className="lodge-field px-3 py-2">
          {guilds.map((guild) => (
            <option key={guild.id} value={guild.id}>
              {guild.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Start date
        <input name="startsOn" type="date" required className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        End date
        <input name="endsOn" type="date" required className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Status
        <select name="status" defaultValue="unavailable" className="lodge-field px-3 py-2">
          <option value="available">Available</option>
          <option value="tentative">Tentative</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </label>
      <button className="lodge-button self-end px-4 py-2 font-medium" disabled={pending}>
        {pending ? 'Saving…' : 'Save period'}
      </button>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2 lg:col-span-5">
        Note (optional)
        <input name="note" maxLength={500} className="lodge-field px-3 py-2" />
      </label>
      {state.message && (
        <p
          role="status"
          className={`text-sm sm:col-span-2 lg:col-span-5 ${state.error ? 'text-amber-200' : 'text-text-muted'}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export function AvailabilityRemoveButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteAvailability, initialState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button className="text-accent hover:underline" disabled={pending}>
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {state.message && (
        <span role="status" className={state.error ? 'text-amber-200' : 'text-text-muted'}>
          {state.message}
        </span>
      )}
    </form>
  );
}
