'use client';

import { useActionState } from 'react';
import { createGuildCalendarEntry, type CalendarState } from '@/app/(app)/war-table/actions';

export function GuildCalendarForm({ guilds }: { guilds: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<CalendarState, FormData>(
    createGuildCalendarEntry,
    {
      message: '',
      error: false,
    },
  );
  return (
    <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2">
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
        Activity
        <select name="category" required className="lodge-field px-3 py-2">
          <option value="mythic_plus">Mythic+</option>
          <option value="alt_run">Alt run</option>
          <option value="achievement">Achievement run</option>
          <option value="meeting">Meeting</option>
          <option value="social">Social event</option>
          <option value="trial">Trial</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Title
        <input name="title" required maxLength={120} className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Date
        <input name="eventDate" type="date" required className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm">
        Time (UTC, optional)
        <input name="eventTime" type="time" className="lodge-field px-3 py-2" />
      </label>
      <label className="text-text-muted grid gap-1 text-sm sm:col-span-2">
        Details
        <textarea name="details" maxLength={1000} className="lodge-field min-h-20 px-3 py-2" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="lodge-button px-4 py-2 font-medium" disabled={pending}>
          {pending ? 'Saving…' : 'Add Guild plan'}
        </button>
        {state.message && (
          <p
            role="status"
            className={state.error ? 'text-sm text-amber-200' : 'text-text-muted text-sm'}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
