import Link from 'next/link';
import { CalendarDays, Compass, ShieldAlert, Swords } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getGuildMemberships, isGuildLeadership, loadGuildRaidOperations } from '@/lib/guilds';
import { getLodgeMemberships, getViewer } from '@/lib/hearth/context';
import { loadMainCharacter } from '@/lib/hearth/main-character';
import { eventDateTime, loadQuestBoard } from '@/lib/quest-board/events';
import { weekEndDate, weeklyResetForRegion } from '@/lib/war-table';
import { createAvailability } from './actions';

export default async function WarTablePage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [params, memberships, guildMemberships, { supabase, user }] = await Promise.all([
    searchParams,
    getLodgeMemberships(),
    getGuildMemberships(),
    getViewer(),
  ]);
  const selected =
    params.lodge === undefined
      ? memberships[0]
      : typeof params.lodge === 'string'
        ? memberships.find((membership) => membership.lodge_id === params.lodge)
        : undefined;
  if (!selected) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const leadershipGuilds = guildMemberships.filter((membership) =>
    isGuildLeadership(membership.guild_member_roles.map(({ role }) => role)),
  );
  const [board, mainCharacter, guildOperations] = await Promise.all([
    loadQuestBoard(supabase, selected.lodge_id, today),
    loadMainCharacter(supabase, user.id),
    Promise.all(
      leadershipGuilds.map(async (membership) => ({
        guild: membership.guilds,
        operations: await loadGuildRaidOperations(membership.guild_id),
      })),
    ),
  ]);
  const weekEnd = weekEndDate();
  const upcoming = (board.upcoming ?? []).filter((event) => event.event_date <= weekEnd);
  const reset = weeklyResetForRegion(
    mainCharacter.state === 'ready' ? mainCharacter.character.region : null,
  );
  const raidOperations = guildOperations.flatMap(({ guild, operations }) =>
    (operations?.operations ?? [])
      .filter((operation) => operation.event_date >= today && operation.event_date <= weekEnd)
      .map((operation) => ({ ...operation, guildId: guild.id, guildName: guild.name })),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="lodge-panel p-6 sm:p-8">
        <p className="text-accent flex items-center gap-2 text-sm font-medium tracking-[0.16em] uppercase">
          <Compass size={18} aria-hidden="true" /> Weekly Command Center
        </p>
        <h1 className="font-display text-text-primary mt-3 text-3xl font-bold sm:text-4xl">
          The War Table
        </h1>
        <p className="text-text-muted mt-3 max-w-2xl">
          Your next seven days, linked to the workflows that own each plan.
        </p>
      </header>

      <section className="grid gap-5 md:grid-cols-2" aria-label="Weekly reset and priorities">
        <article className="lodge-panel p-5 sm:p-6">
          <p className="text-accent flex items-center gap-2 text-sm font-medium">
            <CalendarDays size={18} aria-hidden="true" /> Weekly reset
          </p>
          {reset ? (
            <>
              <p className="text-text-primary mt-3 font-medium">{reset.label}</p>
              <p className="text-text-muted mt-1 text-sm">Next reset: {reset.date}.</p>
            </>
          ) : (
            <p className="text-text-muted mt-3 text-sm">
              Reset timing is unavailable until a Main WoW character from North America or Europe is set.
            </p>
          )}
        </article>
        <article className="lodge-panel p-5 sm:p-6">
          <p className="text-accent flex items-center gap-2 text-sm font-medium">
            <ShieldAlert size={18} aria-hidden="true" /> This week
          </p>
          <p className="text-text-primary mt-3 font-medium">
            {upcoming.length} Lodge {upcoming.length === 1 ? 'event' : 'events'} ahead
            {raidOperations.length ? ` · ${raidOperations.length} leadership raid operations` : ''}.
          </p>
          <p className="text-text-muted mt-1 text-sm">
            Availability, Vault progress, and calendar subscriptions are upcoming War Table slices.
          </p>
        </article>
      </section>

      {guildMemberships.length > 0 && (
        <section className="lodge-panel p-6" aria-labelledby="availability-heading">
          <h2 id="availability-heading" className="font-display text-text-primary text-2xl font-bold">Availability</h2>
          <p className="text-text-muted mt-2 text-sm">Share a dated availability period with Guild leadership. This does not change any Quest Board RSVP.</p>
          <form action={createAvailability} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select name="guildId" className="lodge-field px-3 py-2">{guildMemberships.map((membership) => <option key={membership.guild_id} value={membership.guild_id}>{membership.guilds.name}</option>)}</select>
            <input name="startsOn" type="date" required className="lodge-field px-3 py-2" />
            <input name="endsOn" type="date" required className="lodge-field px-3 py-2" />
            <select name="status" defaultValue="unavailable" className="lodge-field px-3 py-2"><option value="available">Available</option><option value="tentative">Tentative</option><option value="unavailable">Unavailable</option></select>
            <button className="lodge-button px-4 py-2 font-medium">Save period</button>
            <input name="note" maxLength={500} placeholder="Optional note" className="lodge-field px-3 py-2 sm:col-span-2 lg:col-span-5" />
          </form>
        </section>
      )}

      <section className="lodge-panel p-6" aria-labelledby="week-events-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="week-events-heading" className="font-display text-text-primary text-2xl font-bold">
              Lodge calendar
            </h2>
            <p className="text-text-muted mt-1 text-sm">Canonical Quest Board events through {weekEnd}.</p>
          </div>
          <Link className="lodge-button-secondary px-4 py-2 text-sm font-medium" href={`/quest-board?lodge=${selected.lodge_id}`}>
            Open Quest Board
          </Link>
        </div>
        {board.upcoming === null ? (
          <p role="alert" className="text-text-muted mt-5">The weekly calendar could not be loaded.</p>
        ) : upcoming.length === 0 ? (
          <p className="text-text-muted mt-5">No Lodge events are scheduled in the next seven days.</p>
        ) : (
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {upcoming.map((event) => (
              <li key={event.id} className="lodge-list-row p-4">
                <Link className="text-text-primary font-medium hover:underline" href={`/quest-board/${event.id}?lodge=${selected.lodge_id}`}>
                  {event.title}
                </Link>
                <p className="text-text-muted mt-1 text-sm">{eventDateTime(event)} (UTC)</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {leadershipGuilds.length > 0 && (
        <section className="lodge-panel p-6" aria-labelledby="raid-briefing-heading">
          <h2 id="raid-briefing-heading" className="font-display text-text-primary flex items-center gap-2 text-2xl font-bold">
            <Swords className="text-accent" size={22} aria-hidden="true" /> Leadership briefing
          </h2>
          <p className="text-text-muted mt-2 text-sm">Authorized Guild operations only; Quest Board RSVPs remain separate.</p>
          {raidOperations.length === 0 ? (
            <p className="text-text-muted mt-5">No Guild raid operations are scheduled in this weekly view.</p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {raidOperations.map((operation) => (
                <li key={operation.id} className="lodge-list-row flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-text-primary font-medium">{operation.title}</p>
                    <p className="text-text-muted mt-1 text-sm">{operation.guildName} · {operation.event_date}</p>
                  </div>
                  <Link className="lodge-button-secondary px-4 py-2 text-sm font-medium" href={`/guild-hall/raid-room?guild=${operation.guildId}&operation=${operation.id}`}>
                    Open Raid Mode
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
