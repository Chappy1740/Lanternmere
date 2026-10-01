import Link from 'next/link';
import { CalendarDays, Compass, ShieldAlert, Swords } from 'lucide-react';
import { notFound } from 'next/navigation';
import { WarTableVaultForm } from '@/components/war-table-vault-form';
import { GuildCalendarForm } from '@/components/guild-calendar-form';
import { GuildVaultSharingControls } from '@/components/guild-vault-sharing-controls';
import {
  getGuildMemberships,
  isGuildLeadership,
  isGuildRosterSnapshotFresh,
  loadGuildRaidOperations,
  loadGuildReadiness,
  loadGuildRoster,
} from '@/lib/guilds';
import { getOptionalLodgeMemberships, getViewer } from '@/lib/hearth/context';
import { loadMainCharacter } from '@/lib/hearth/main-character';
import { eventDateTime, loadQuestBoard } from '@/lib/quest-board/events';
import { weekEndDate, weeklyResetForRegion } from '@/lib/war-table';
import { createAvailability, deleteAvailability, deleteGuildCalendarEntry } from './actions';

export default async function WarTablePage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string | string[] }>;
}) {
  const [params, memberships, guildMemberships, { supabase, user }] = await Promise.all([
    searchParams,
    getOptionalLodgeMemberships(),
    getGuildMemberships(),
    getViewer(),
  ]);
  const selected =
    params.lodge === undefined
      ? memberships[0]
      : typeof params.lodge === 'string'
        ? memberships.find((membership) => membership.lodge_id === params.lodge)
        : undefined;
  if (params.lodge !== undefined && !selected) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const leadershipGuilds = guildMemberships.filter((membership) =>
    isGuildLeadership(membership.guild_member_roles.map(({ role }) => role)),
  );
  const [board, mainCharacter, guildBriefings, availabilityResult, leadershipAvailabilityResult] =
    await Promise.all([
      selected
        ? loadQuestBoard(supabase, selected.lodge_id, today)
        : Promise.resolve({ upcoming: [], past: [] }),
      loadMainCharacter(supabase, user.id),
      Promise.all(
        leadershipGuilds.map(async (membership) => ({
          guild: membership.guilds,
          operations: await loadGuildRaidOperations(membership.guild_id),
          readiness: await loadGuildReadiness(membership.guild_id),
          roster: await loadGuildRoster(membership.guild_id),
        })),
      ),
      supabase
        .from('guild_member_availability')
        .select('id, guild_id, starts_on, ends_on, availability_status, note')
        .eq('profile_id', user.id)
        .gte('ends_on', today)
        .order('starts_on')
        .order('id'),
      leadershipGuilds.length
        ? supabase
            .from('guild_member_availability')
            .select(
              'id, guild_id, profile_id, starts_on, ends_on, availability_status, note, profiles(display_name)',
            )
            .in(
              'guild_id',
              leadershipGuilds.map((membership) => membership.guild_id),
            )
            .gte('ends_on', today)
            .neq('availability_status', 'available')
            .order('starts_on')
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
    ]);
  const weekEnd = weekEndDate();
  const upcoming = (board.upcoming ?? []).filter((event) => event.event_date <= weekEnd);
  const reset = weeklyResetForRegion(
    mainCharacter.state === 'ready' ? mainCharacter.character.region : null,
  );
  const raidOperations = guildBriefings.flatMap(({ guild, operations }) =>
    (operations?.operations ?? [])
      .filter((operation) => operation.event_date >= today && operation.event_date <= weekEnd)
      .map((operation) => ({
        ...operation,
        guildId: guild.id,
        guildName: guild.name,
        planning: operations!,
      })),
  );
  const availability = availabilityResult.error ? null : availabilityResult.data;
  const leadershipAvailability = leadershipAvailabilityResult.error
    ? null
    : leadershipAvailabilityResult.data;
  const [rsvpResult, vaultResult, guildCalendarResult] = await Promise.all([
    upcoming.length
      ? supabase
          .from('event_attendees')
          .select('event_id, rsvp_status')
          .eq('profile_id', user.id)
          .in(
            'event_id',
            upcoming.map((event) => event.id),
          )
      : Promise.resolve({ data: [], error: null }),
    reset && mainCharacter.state === 'ready'
      ? supabase
          .from('weekly_vault_progress')
          .select('id, raid_progress, dungeon_progress, world_progress, notes, updated_at')
          .eq('character_id', mainCharacter.character.id)
          .eq('reset_on', reset.isoDate)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    guildMemberships.length
      ? supabase
          .from('guild_calendar_entries')
          .select('id, guild_id, title, category, event_date, event_time, details')
          .in(
            'guild_id',
            guildMemberships.map((membership) => membership.guild_id),
          )
          .gte('event_date', today)
          .lte('event_date', weekEnd)
          .order('event_date')
          .order('event_time', { nullsFirst: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const guildCalendar = guildCalendarResult.error ? null : guildCalendarResult.data;
  const [ownSharingResult, leadershipSharingResult] = await Promise.all([
    vaultResult.data && guildMemberships.length
      ? supabase
          .from('guild_vault_sharing')
          .select('guild_id')
          .eq('vault_progress_id', vaultResult.data.id)
      : Promise.resolve({ data: [], error: null }),
    leadershipGuilds.length
      ? supabase
          .from('guild_vault_sharing')
          .select('guild_id, vault_progress_id')
          .in(
            'guild_id',
            leadershipGuilds.map((membership) => membership.guild_id),
          )
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const leadershipShares = leadershipSharingResult.error ? null : leadershipSharingResult.data;
  const leadershipVaultResult = leadershipShares?.length
    ? await supabase
        .from('weekly_vault_progress')
        .select('id, reset_on, raid_progress, dungeon_progress, world_progress, notes, updated_at')
        .in(
          'id',
          leadershipShares.map((share) => share.vault_progress_id),
        )
        .gte('reset_on', today)
        .lte('reset_on', weekEnd)
    : { data: [], error: null };
  const leadershipVault = leadershipVaultResult.error ? null : leadershipVaultResult.data;
  const sharedVaultContext =
    leadershipShares && leadershipVault
      ? leadershipShares.flatMap((share) => {
          const progress = leadershipVault.find((entry) => entry.id === share.vault_progress_id);
          const guild = leadershipGuilds.find(
            (membership) => membership.guild_id === share.guild_id,
          );
          return progress && guild
            ? [{ ...progress, guildId: guild.guild_id, guildName: guild.guilds.name }]
            : [];
        })
      : null;
  const rsvps = new Map((rsvpResult.data ?? []).map((row) => [row.event_id, row.rsvp_status]));
  const openPlans = upcoming.filter(
    (event) => rsvps.get(event.id) !== 'confirmed' && rsvps.get(event.id) !== 'declined',
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

      {memberships.length > 1 && (
        <nav aria-label="Choose Lodge calendar" className="flex flex-wrap gap-2">
          {memberships.map((membership) => (
            <Link
              key={membership.lodge_id}
              href={`/war-table?lodge=${membership.lodge_id}`}
              className="lodge-button-secondary px-4 py-2 text-sm"
            >
              {membership.lodges.name}
            </Link>
          ))}
        </nav>
      )}

      <section className="grid gap-5 md:grid-cols-2" aria-label="Weekly reset and priorities">
        <article className="lodge-panel p-5 sm:p-6">
          <p className="text-accent flex items-center gap-2 text-sm font-medium">
            <CalendarDays size={18} aria-hidden="true" /> Expected weekly reset
          </p>
          {reset ? (
            <>
              <p className="text-text-primary mt-3 font-medium">{reset.label}</p>
              <p className="text-text-muted mt-1 text-sm">Next reset: {reset.date}.</p>
              <p className="text-text-muted mt-2 text-xs">Maintenance can change the actual in-game reset time.</p>
            </>
          ) : (
            <p className="text-text-muted mt-3 text-sm">
              Reset timing is unavailable until a Main WoW character from North America or Europe is
              set.
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
            {openPlans.length} Lodge {openPlans.length === 1 ? 'plan needs' : 'plans need'} your
            RSVP or a decision.
          </p>
        </article>
      </section>

      <section className="lodge-panel p-6" aria-labelledby="priorities-heading">
        <h2 id="priorities-heading" className="font-display text-text-primary text-2xl font-bold">
          Your priorities
        </h2>
        {selected ? (
          board.upcoming === null ? (
            <p role="alert" className="text-text-muted mt-3">
              Your Lodge plans could not be loaded.
            </p>
          ) : openPlans.length ? (
            <ul className="mt-4 grid gap-2">
              {openPlans.map((event) => (
                <li key={event.id} className="lodge-list-row p-3 text-sm">
                  <Link
                    className="text-text-primary font-medium hover:underline"
                    href={`/quest-board/${event.id}?lodge=${selected.lodge_id}`}
                  >
                    {event.title}
                  </Link>
                  <span className="text-text-muted">
                    {' '}
                    · {event.event_date} ·{' '}
                    {rsvps.get(event.id) === 'tentative' ? 'Tentative RSVP' : 'No RSVP yet'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted mt-3">
              No open RSVP decisions for this Lodge in the next seven days.
            </p>
          )
        ) : (
          <p className="text-text-muted mt-3">
            Join a Lodge to see personal Quest Board plans. Your Guild briefing remains available
            below.
          </p>
        )}
      </section>

      <section className="lodge-panel p-6" aria-labelledby="vault-heading">
        <h2 id="vault-heading" className="font-display text-text-primary text-2xl font-bold">
          Vault context
        </h2>
        <p className="text-text-muted mt-2 text-sm">
          Your own notes for the next reset. These are player-entered and private; Lanternmere does
          not claim to verify Great Vault rewards or thresholds.
        </p>
        {mainCharacter.state === 'ready' && reset ? (
          <>
            <p className="text-text-muted mt-3 text-sm">
              {mainCharacter.character.character_name} · reset {reset.date}
              {vaultResult.data?.updated_at
                ? ` · updated ${new Date(vaultResult.data.updated_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
                : ''}
            </p>
            {vaultResult.error ? (
              <p role="alert" className="text-text-muted mt-3">
                Vault context could not be loaded.
              </p>
            ) : (
              <>
                <WarTableVaultForm
                  characterId={mainCharacter.character.id}
                  resetOn={reset.isoDate}
                  progress={vaultResult.data}
                />
                {vaultResult.data &&
                  guildMemberships.length > 0 &&
                  (ownSharingResult.error ? (
                    <p role="alert" className="text-text-muted mt-3">
                      Vault sharing choices could not be loaded.
                    </p>
                  ) : (
                    <GuildVaultSharingControls
                      progressId={vaultResult.data.id}
                      guilds={guildMemberships.map((membership) => ({
                        id: membership.guild_id,
                        name: membership.guilds.name,
                      }))}
                      sharedGuildIds={(ownSharingResult.data ?? []).map((share) => share.guild_id)}
                    />
                  ))}
              </>
            )}
          </>
        ) : (
          <p className="text-text-muted mt-3">
            Choose a Main WoW character from North America or Europe to record reset-week context.
          </p>
        )}
      </section>

      {guildMemberships.length > 0 && (
        <section className="lodge-panel p-6" aria-labelledby="availability-heading">
          <h2
            id="availability-heading"
            className="font-display text-text-primary text-2xl font-bold"
          >
            Availability
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Share a dated availability period with Guild leadership. This does not change any Quest
            Board RSVP.
          </p>
          <form
            action={createAvailability}
            className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <select name="guildId" className="lodge-field px-3 py-2">
              {guildMemberships.map((membership) => (
                <option key={membership.guild_id} value={membership.guild_id}>
                  {membership.guilds.name}
                </option>
              ))}
            </select>
            <input name="startsOn" type="date" required className="lodge-field px-3 py-2" />
            <input name="endsOn" type="date" required className="lodge-field px-3 py-2" />
            <select name="status" defaultValue="unavailable" className="lodge-field px-3 py-2">
              <option value="available">Available</option>
              <option value="tentative">Tentative</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <button className="lodge-button px-4 py-2 font-medium">Save period</button>
            <input
              name="note"
              maxLength={500}
              placeholder="Optional note"
              className="lodge-field px-3 py-2 sm:col-span-2 lg:col-span-5"
            />
          </form>
          {availability === null ? (
            <p role="alert" className="text-text-muted mt-5 text-sm">
              Your recorded availability could not be loaded.
            </p>
          ) : availability.length === 0 ? (
            <p className="text-text-muted mt-5 text-sm">
              No upcoming availability periods recorded.
            </p>
          ) : (
            <ul className="mt-5 grid gap-2" aria-label="Your recorded availability">
              {availability.map((period) => {
                const guild = guildMemberships.find(
                  (membership) => membership.guild_id === period.guild_id,
                );
                return (
                  <li
                    key={period.id}
                    className="lodge-list-row flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                  >
                    <span>
                      <span className="text-text-primary font-medium">
                        {period.availability_status}
                      </span>{' '}
                      · {period.starts_on} to {period.ends_on} · {guild?.guilds.name ?? 'Guild'}
                      {period.note ? ` · ${period.note}` : ''}
                    </span>
                    <form action={deleteAvailability}>
                      <input type="hidden" name="id" value={period.id} />
                      <button className="text-accent hover:underline">Remove</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {selected && (
        <section className="lodge-panel p-6" aria-labelledby="week-events-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="week-events-heading"
                className="font-display text-text-primary text-2xl font-bold"
              >
                Lodge calendar
              </h2>
              <p className="text-text-muted mt-1 text-sm">
                Canonical Quest Board events through {weekEnd}. Activity types can include raids,
                Mythic+, alt runs, achievement runs, meetings, social events, and trials.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="lodge-button-secondary px-4 py-2 text-sm font-medium"
                href={`/quest-board?lodge=${selected.lodge_id}`}
              >
                Open Quest Board
              </Link>
              <a
                className="lodge-button-secondary px-4 py-2 text-sm font-medium"
                href={`/war-table/calendar?lodge=${selected.lodge_id}`}
              >
                Export calendar (.ics)
              </a>
            </div>
          </div>
          {board.upcoming === null ? (
            <p role="alert" className="text-text-muted mt-5">
              The weekly calendar could not be loaded.
            </p>
          ) : upcoming.length === 0 ? (
            <p className="text-text-muted mt-5">
              No Lodge events are scheduled in the next seven days.
            </p>
          ) : (
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {upcoming.map((event) => (
                <li key={event.id} className="lodge-list-row p-4">
                  <Link
                    className="text-text-primary font-medium hover:underline"
                    href={`/quest-board/${event.id}?lodge=${selected.lodge_id}`}
                  >
                    {event.title}
                  </Link>
                  <p className="text-text-muted mt-1 text-sm">{eventDateTime(event)} (UTC)</p>
                  <p className="text-text-muted mt-1 text-sm">
                    {event.activity_type || 'Lodge event'} ·{' '}
                    {rsvps.get(event.id) ? `${rsvps.get(event.id)} RSVP` : 'No RSVP yet'}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-text-muted mt-5 text-xs">
            Export is a snapshot of Lodge events you can currently access. Private calendars are not
            exposed through a public subscription URL.
          </p>
        </section>
      )}

      {guildMemberships.length > 0 && (
        <section
          id="guild-calendar"
          className="lodge-panel p-6"
          aria-labelledby="guild-calendar-heading"
        >
          <h2
            id="guild-calendar-heading"
            className="font-display text-text-primary text-2xl font-bold"
          >
            Guild calendar
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Guild-owned plans for the next seven days. Raid operations stay linked to their
            canonical Quest Board event in the leadership briefing below.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {guildMemberships.map((membership) => (
              <a
                key={membership.guild_id}
                className="lodge-button-secondary px-3 py-2 text-sm"
                href={`/war-table/calendar?guild=${membership.guild_id}`}
              >
                Export {membership.guilds.name} (.ics)
              </a>
            ))}
          </div>
          {guildCalendar === null ? (
            <p role="alert" className="text-text-muted mt-5">
              Guild plans could not be loaded.
            </p>
          ) : guildCalendar.length === 0 ? (
            <p className="text-text-muted mt-5">
              No Guild plans are scheduled in this weekly view.
            </p>
          ) : (
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {guildCalendar.map((entry) => {
                const guild = guildMemberships.find(
                  (membership) => membership.guild_id === entry.guild_id,
                );
                const canRemove = leadershipGuilds.some(
                  (membership) => membership.guild_id === entry.guild_id,
                );
                return (
                  <li key={entry.id} className="lodge-list-row p-4">
                    <p className="text-text-primary font-medium">{entry.title}</p>
                    <p className="text-text-muted mt-1 text-sm">
                      {guild?.guilds.name ?? 'Guild'} · {entry.category.replaceAll('_', ' ')} ·{' '}
                      {entry.event_date}
                      {entry.event_time
                        ? ` at ${entry.event_time.slice(0, 5)} UTC`
                        : ' · time to be arranged'}
                    </p>
                    {entry.details && (
                      <p className="text-text-muted mt-2 text-sm">{entry.details}</p>
                    )}
                    {canRemove && (
                      <form action={deleteGuildCalendarEntry} className="mt-3">
                        <input type="hidden" name="id" value={entry.id} />
                        <button className="text-accent text-sm hover:underline">Remove plan</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {leadershipGuilds.length > 0 && (
            <div className="mt-7 border-t border-white/10 pt-5">
              <h3 className="font-display text-text-primary text-lg font-bold">Add a Guild plan</h3>
              <p className="text-text-muted mt-2 text-sm">
                Use Guild Hall to authorize raid operations. This form is for other Guild
                activities.
              </p>
              <GuildCalendarForm
                guilds={leadershipGuilds.map((membership) => ({
                  id: membership.guild_id,
                  name: membership.guilds.name,
                }))}
              />
            </div>
          )}
          <p className="text-text-muted mt-5 text-xs">
            Exports are one-time snapshots. A public subscription feed would expose private Guild
            plans, so it is not offered.
          </p>
        </section>
      )}

      {leadershipGuilds.length > 0 && (
        <section className="lodge-panel p-6" aria-labelledby="raid-briefing-heading">
          <h2
            id="raid-briefing-heading"
            className="font-display text-text-primary flex items-center gap-2 text-2xl font-bold"
          >
            <Swords className="text-accent" size={22} aria-hidden="true" /> Leadership briefing
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Authorized Guild operations only; Quest Board RSVPs remain separate.
          </p>
          {guildBriefings.some(({ operations }) => operations === null) && (
            <p role="alert" className="text-text-muted mt-3 text-sm">
              Some raid operations could not be loaded.
            </p>
          )}
          {raidOperations.length === 0 ? (
            <p className="text-text-muted mt-5">
              No Guild raid operations are scheduled in this weekly view.
            </p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {raidOperations.map((operation) => {
                const confirmed = new Set(
                  operation.planning.attendance
                    .filter(
                      (row) =>
                        row.operation_id === operation.id &&
                        ['confirmed', 'attended', 'late'].includes(row.attendance_status),
                    )
                    .map((row) => row.guild_member_id),
                );
                const confirmationGaps = operation.planning.members.filter(
                  (row) =>
                    row.operation_id === operation.id &&
                    row.planning_status === 'selected' &&
                    !confirmed.has(row.guild_member_id),
                ).length;
                return (
                  <li
                    key={operation.id}
                    className="lodge-list-row flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="text-text-primary font-medium">{operation.title}</p>
                      <p className="text-text-muted mt-1 text-sm">
                        {operation.guildName} · {operation.event_date}
                      </p>
                      <p className="text-text-muted mt-1 text-sm">
                        {confirmationGaps} selected member confirmation gaps ·{' '}
                        {
                          operation.planning.assignments.filter(
                            (row) =>
                              row.operation_id === operation.id && !row.assigned_guild_member_id,
                          ).length
                        }{' '}
                        unassigned tasks
                      </p>
                    </div>
                    <Link
                      className="lodge-button-secondary px-4 py-2 text-sm font-medium"
                      href={`/guild-hall/raid-room?guild=${operation.guildId}&operation=${operation.id}`}
                    >
                      Open Raid Mode
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <h3 className="font-display text-text-primary mt-7 text-lg font-bold">
            Readiness and source freshness
          </h3>
          <ul className="mt-3 grid gap-2">
            {guildBriefings.map(({ guild, readiness, roster }) => {
              const stale = readiness.filter(
                (character) =>
                  !character.character_snapshots.some(
                    (snapshot) =>
                      Date.now() - Date.parse(snapshot.last_refreshed_at) < 24 * 60 * 60 * 1000,
                  ),
              ).length;
              return (
                <li key={guild.id} className="lodge-list-row p-3 text-sm">
                  <Link
                    className="text-text-primary font-medium hover:underline"
                    href={`/guild-hall?guild=${guild.id}`}
                  >
                    {guild.name}
                  </Link>
                  <span className="text-text-muted">
                    {' '}
                    · {readiness.length} consented character profiles · {stale} without a fresh
                    24-hour snapshot · official roster{' '}
                    {roster
                      ? isGuildRosterSnapshotFresh(roster.snapshot.refreshed_at)
                        ? 'fresh'
                        : 'stale'
                      : 'unavailable'}
                    {roster?.snapshot.failure_message ? ' (last refresh failed)' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
          <h3 className="font-display text-text-primary mt-7 text-lg font-bold">
            Consented Vault context
          </h3>
          <p className="text-text-muted mt-2 text-sm">
            Player-entered notes shared with this Guild’s verified leadership. These are not
            Blizzard-verified progress or a member score.
          </p>
          {sharedVaultContext === null ? (
            <p role="alert" className="text-text-muted mt-3 text-sm">
              Shared Vault context could not be loaded.
            </p>
          ) : sharedVaultContext.length === 0 ? (
            <p className="text-text-muted mt-3 text-sm">
              No members have shared Vault context for an upcoming reset.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {sharedVaultContext.map((entry) => (
                <li key={`${entry.guildId}-${entry.id}`} className="lodge-list-row p-3 text-sm">
                  <p className="text-text-primary font-medium">
                    {entry.guildName} · reset {entry.reset_on}
                  </p>
                  <p className="text-text-muted mt-1">
                    Raid: {entry.raid_progress || 'No note'} · Dungeons:{' '}
                    {entry.dungeon_progress || 'No note'} · World:{' '}
                    {entry.world_progress || 'No note'}
                  </p>
                  {entry.notes && <p className="text-text-muted mt-1">{entry.notes}</p>}
                </li>
              ))}
            </ul>
          )}
          <h3 className="font-display text-text-primary mt-7 text-lg font-bold">
            Upcoming availability signals
          </h3>
          {leadershipAvailability === null ? (
            <p role="alert" className="text-text-muted mt-3 text-sm">
              Availability signals could not be loaded.
            </p>
          ) : leadershipAvailability.length === 0 ? (
            <p className="text-text-muted mt-3 text-sm">
              No upcoming tentative or unavailable periods recorded.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {leadershipAvailability.map((period) => (
                <li key={period.id} className="lodge-list-row p-3 text-sm">
                  <span className="text-text-primary font-medium">
                    {period.profiles?.[0]?.display_name ?? 'Guild member'}
                  </span>{' '}
                  · {period.availability_status} · {period.starts_on} to {period.ends_on}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
