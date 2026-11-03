import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  getGuildMemberships,
  isGuildLeadership,
  loadGuildMembers,
  loadGuildRaidOperations,
} from '@/lib/guilds';
import {
  loadOwnWeeklyProgress,
  loadSharedWeeklyProgress,
  loadWeeklyRequirement,
} from '@/lib/guild-weekly-progress';
import { buildProgressRows } from '@/lib/weekly-raider-progress';
import { weeklyResetForRegion } from '@/lib/war-table';
import { WeeklyReportForm, WeeklyRequirementForm } from '@/components/guild-weekly-progress-forms';
import { GuildWeeklyProgressBoard } from '@/components/guild-weekly-progress-board';

export default async function GuildProgressPage({
  searchParams,
}: {
  searchParams: Promise<{
    guild?: string | string[];
    operation?: string | string[];
    region?: string | string[];
  }>;
}) {
  const [params, memberships] = await Promise.all([searchParams, getGuildMemberships()]);
  const selected =
    params.guild === undefined
      ? memberships[0]
      : typeof params.guild === 'string'
        ? memberships.find((entry) => entry.guild_id === params.guild)
        : undefined;
  if (!selected) notFound();
  const leadership =
    selected.verified && isGuildLeadership(selected.guild_member_roles.map(({ role }) => role));
  const region =
    params.region === undefined
      ? 'us'
      : params.region === 'us' || params.region === 'eu'
        ? params.region
        : null;
  if (!region) notFound();
  const operationId =
    params.operation === undefined || params.operation === ''
      ? null
      : z.uuid().safeParse(params.operation);
  if (operationId !== null && (!operationId.success || !leadership)) notFound();
  const scope = operationId?.data ?? null;
  const reset = weeklyResetForRegion(region)!;
  const previousReset = weeklyResetForRegion(
    region,
    new Date(Date.parse(reset.at) - 8 * 86400_000),
  )!;
  const [target, own, shared, members, operations] = await Promise.all([
    loadWeeklyRequirement(selected.guild_id, scope, region, reset.isoDate),
    loadOwnWeeklyProgress(selected.guild_id, region, reset.isoDate),
    leadership ? loadSharedWeeklyProgress(selected.guild_id, region, reset.isoDate) : null,
    leadership ? loadGuildMembers(selected.guild_id) : null,
    leadership ? loadGuildRaidOperations(selected.guild_id) : null,
  ]);
  if (scope && operations && !operations.operations.some((entry) => entry.id === scope)) notFound();
  const available =
    target.ok &&
    own !== null &&
    (!leadership || (shared !== null && members !== null && operations !== null));
  const requirement = target.ok ? target.requirement : null;
  const rows =
    available && leadership && shared && members && operations
      ? buildProgressRows({
          members: members.map((member) => ({
            id: member.id,
            profile_id: member.profile_id,
            name: member.profiles?.display_name || 'Guild member',
          })),
          characters: shared.characters,
          reports: shared.reports,
          requirement,
          selection: scope
            ? operations.members.filter((entry) => entry.operation_id === scope)
            : null,
          region,
          resetOn: reset.isoDate,
          weekStartsAt: previousReset.at,
          weekEndsAt: reset.at,
        })
      : [];
  const scopeTitle = scope
    ? (operations?.operations.find((entry) => entry.id === scope)?.title ?? 'Raid roster')
    : 'Joined Guild members';
  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">
      <header className="lodge-panel p-5 sm:p-8">
        <p className="lodge-kicker">The War Table · Team readiness</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-bold">
          {selected.guilds.name}: weekly progress
        </h1>
        <p className="text-text-secondary mt-3">
          {scopeTitle} · {region.toUpperCase()} · Week ending {reset.isoDate}
        </p>
        <p className="text-text-muted mt-2 text-sm">
          Reset: {reset.date} · {reset.label}
        </p>
        <Link
          href={`/guild-hall?guild=${selected.guild_id}`}
          className="text-accent mt-3 inline-block min-h-11 py-2 text-sm underline"
        >
          Back to Guild Hall and sharing controls
        </Link>
        <form method="get" className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Guild
            <select
              name="guild"
              defaultValue={selected.guild_id}
              className="border-border bg-background mt-1 min-h-11 w-full rounded-md border px-3"
            >
              {memberships.map((entry) => (
                <option key={entry.guild_id} value={entry.guild_id}>
                  {entry.guilds.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Region
            <select
              name="region"
              defaultValue={region}
              className="border-border bg-background mt-1 min-h-11 w-full rounded-md border px-3"
            >
              <option value="us">North America</option>
              <option value="eu">Europe</option>
            </select>
          </label>
          <button className="lodge-button-secondary min-h-11 self-end px-4 py-2">
            Open Guild week
          </button>
        </form>
        {leadership && operations && (
          <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="guild" value={selected.guild_id} />
            <input type="hidden" name="region" value={region} />
            <label className="min-w-0 flex-1 text-sm">
              Roster
              <select
                name="operation"
                defaultValue={scope ?? ''}
                className="border-border bg-background mt-1 min-h-11 w-full rounded-md border px-3"
              >
                <option value="">Joined Guild members</option>
                {operations.operations.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title} · {entry.event_date}
                  </option>
                ))}
              </select>
            </label>
            <button className="lodge-button-secondary min-h-11 px-4 py-2">Open roster</button>
          </form>
        )}
      </header>
      {!available ? (
        <section className="lodge-panel p-6">
          <h2 className="text-text-primary font-semibold">
            Weekly progress is temporarily unavailable
          </h2>
          <p className="text-text-secondary mt-2">
            No completion results are shown. Try again later.
          </p>
        </section>
      ) : (
        <>
          {leadership ? (
            <>
              <WeeklyRequirementForm
                key={`${scope}:${region}:${reset.isoDate}`}
                guildId={selected.guild_id}
                operationId={scope}
                region={region}
                resetOn={reset.isoDate}
                requirement={requirement}
              />
              <GuildWeeklyProgressBoard rows={rows} requirement={requirement} />
              <p className="text-text-muted text-sm">
                Raid rosters reuse the selected and bench members configured in Guild Hall → Raid
                Mode. Select a shared Traveler there for each planned member. Missing sharing or
                character selection stays unknown.
              </p>
            </>
          ) : (
            <section className="lodge-panel p-5">
              <h2 className="font-display text-text-primary text-xl font-bold">
                Your Guild’s weekly target
              </h2>
              <p className="text-text-secondary mt-3">
                {requirement
                  ? `${requirement.mythic_runs_required} Mythic+ runs at +${requirement.minimum_key_level} or higher${requirement.raid_bosses_required !== null ? ` and ${requirement.raid_bosses_required} raid boss kills` : ''}.`
                  : 'No Guild-wide target has been set for this week.'}
              </p>
              <p className="text-text-muted mt-2 text-sm">
                The team comparison is available to verified Guild Masters, officers and raid
                leaders.
              </p>
            </section>
          )}
          <section aria-labelledby="own-progress-heading" className="space-y-4">
            <h2
              id="own-progress-heading"
              className="font-display text-text-primary text-2xl font-bold"
            >
              Your weekly reports
            </h2>
            <p className="text-text-muted text-sm">
              Blizzard observations appear in the team details when a Traveler is shared. Full
              weekly totals and Vault slots need a player report here. No addon is required.
              Unsupported regions are not inferred.
            </p>
            {own!.characters.map((character) => {
              const report =
                own!.reports.find((entry) => entry.character_id === character.id) ?? null;
              return (
                <WeeklyReportForm
                  key={`${character.id}:${reset.isoDate}`}
                  guildId={selected.guild_id}
                  guildName={selected.guilds.name}
                  characterId={character.id}
                  characterName={`${character.character_name} · ${character.realm_slug}`}
                  resetOn={reset.isoDate}
                  report={report}
                  shared={!!report && own!.sharedIds.includes(report.id)}
                  sharedElsewhere={!!report && own!.sharedElsewhereIds.includes(report.id)}
                  characterShared={character.character_guild_sharing.some(
                    (entry) => entry.guild_id === selected.guild_id,
                  )}
                />
              );
            })}
            {!own!.characters.length && (
              <p className="text-text-secondary">
                No Travelers in this region. Choose their region above or add a Traveler first.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
