import Link from 'next/link';
import { z } from 'zod';
import {
  getGuildMemberships,
  isGuildLeadership,
  loadGuildRaidLoot,
  loadGuildRaidOperations,
} from '@/lib/guilds';
import { getViewer } from '@/lib/hearth/context';
import { raidProgressionEntries } from '@/lib/raiderio-progress';
import { fetchPublicLogReport } from '@/lib/warcraft-logs';
import { parsePublicReportCode } from '@/lib/warcraft-logs-input';

const historySchema = z.array(
  z.object({
    character_id: z.uuid(),
    mythic_plus_score: z.number().nullable(),
    season_label: z.string().nullable(),
    best_runs: z.array(
      z.object({ dungeon: z.string(), level: z.number().int(), score: z.number().nullable() }),
    ),
    raid_progression: z.unknown(),
    source_url: z.string().url(),
    refreshed_at: z.string(),
  }),
);
const characterSchema = z.array(
  z.object({ id: z.uuid(), character_name: z.string(), realm_slug: z.string() }),
);
const raidbotsSchema = z.array(
  z.object({
    character_id: z.uuid(),
    lodge_id: z.uuid(),
    report_url: z.string().url(),
    updated_at: z.string(),
  }),
);

function dateTime(value: string | number) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export default async function ChronicleLensPage({
  searchParams,
}: {
  searchParams: Promise<{
    guild?: string | string[];
    operation?: string | string[];
    report?: string | string[];
  }>;
}) {
  const [params, memberships, { supabase, user }] = await Promise.all([
    searchParams,
    getGuildMemberships(),
    getViewer(),
  ]);
  const leaders = memberships.filter(
    (membership) =>
      membership.verified &&
      isGuildLeadership(membership.guild_member_roles.map((entry) => entry.role)),
  );
  const guild =
    (typeof params.guild === 'string'
      ? leaders.find((membership) => membership.guild_id === params.guild)
      : null) ?? leaders[0];

  const characterResult = await supabase
    .from('characters')
    .select('id, character_name, realm_slug')
    .eq('profile_id', user.id)
    .order('character_name')
    .limit(30);
  const characters = characterSchema.safeParse(characterResult.data);
  if (characterResult.error || !characters.success)
    throw new Error('Unable to load your Travelers.');
  const ids = characters.data.map((character) => character.id);
  const [historyResult, raidbotsResult, operationData] = await Promise.all([
    ids.length
      ? supabase
          .from('character_raiderio_history')
          .select(
            'character_id, mythic_plus_score, season_label, best_runs, raid_progression, source_url, refreshed_at',
          )
          .in('character_id', ids)
          .order('refreshed_at', { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase
          .from('character_raidbots_reports')
          .select('character_id, lodge_id, report_url, updated_at')
          .in('character_id', ids)
          .order('updated_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
    guild ? loadGuildRaidOperations(guild.guild_id) : Promise.resolve(null),
  ]);
  const history = historySchema.safeParse(historyResult.data);
  const raidbots = raidbotsSchema.safeParse(raidbotsResult.data);
  if (historyResult.error || !history.success || raidbotsResult.error || !raidbots.success)
    throw new Error('Unable to load progression history.');

  const selectedOperation =
    operationData && typeof params.operation === 'string'
      ? operationData.operations.find((operation) => operation.id === params.operation)
      : null;
  const loot = selectedOperation ? await loadGuildRaidLoot(selectedOperation.id) : null;
  const reportInput = typeof params.report === 'string' ? params.report.slice(0, 200) : '';
  const reportCode = reportInput ? parsePublicReportCode(reportInput) : null;
  const logResult = selectedOperation && reportCode ? await fetchPublicLogReport(reportCode) : null;
  const characterById = new Map(characters.data.map((character) => [character.id, character]));

  return (
    <main className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="space-y-2">
        <p className="lodge-kicker">Progression intelligence</p>
        <h1 className="font-display text-text-primary text-3xl font-bold">The Chronicle Lens</h1>
        <p className="text-text-muted max-w-3xl">
          Review dated progress and your Guild&apos;s recorded raid activity. Warcraft Logs and
          Raider.IO remain the sources for their own data; this view makes no player ranking or
          performance judgment.
        </p>
      </header>

      <section className="lodge-panel space-y-4 p-6" aria-labelledby="own-progress-heading">
        <div>
          <h2 id="own-progress-heading" className="font-display text-text-primary text-xl">
            Your Raider.IO timeline
          </h2>
          <p className="text-text-muted text-sm">
            Only you can see this detailed history. Each point comes from a Traveler refresh; gaps
            mean no saved refresh, not no activity.
          </p>
        </div>
        {!history.data.length ? (
          <p className="text-text-muted text-sm">
            No snapshots yet. Refresh Raider.IO on one of your Traveler pages to begin a timeline.
          </p>
        ) : (
          <div className="space-y-3">
            {history.data.map((point) => {
              const character = characterById.get(point.character_id);
              const progression = raidProgressionEntries(point.raid_progression);
              return (
                <article
                  key={`${point.character_id}-${point.refreshed_at}`}
                  className="border-border rounded-lg border p-3 text-sm"
                >
                  <p className="text-text-primary font-medium">
                    {character?.character_name ?? 'Your Traveler'} · {character?.realm_slug ?? ''}
                  </p>
                  <p className="text-text-muted">
                    Saved {dateTime(point.refreshed_at)} UTC · Mythic+ score{' '}
                    {point.mythic_plus_score ?? 'unavailable'} ·{' '}
                    {point.season_label ?? 'season not recorded'}
                  </p>
                  {point.best_runs.length > 0 && (
                    <p className="text-text-muted">
                      Best dungeon runs:{' '}
                      {point.best_runs
                        .slice(0, 4)
                        .map(
                          (run) =>
                            `${run.dungeon} +${run.level}${run.score === null ? '' : ` (${run.score} score)`}`,
                        )
                        .join(' · ')}
                    </p>
                  )}
                  {progression.length > 0 && (
                    <p className="text-text-muted">
                      Raid progress:{' '}
                      {progression.map((entry) => `${entry.raid}: ${entry.summary}`).join(' · ')}
                    </p>
                  )}
                  <a
                    href={point.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    View on Raider.IO
                  </a>
                </article>
              );
            })}
          </div>
        )}
        <Link href="/travelers" className="text-accent text-sm underline">
          Manage Traveler sharing and refreshes
        </Link>
      </section>

      <section className="lodge-panel space-y-3 p-6" aria-labelledby="raidbots-heading">
        <h2 id="raidbots-heading" className="font-display text-text-primary text-xl">
          Your Raidbots handoffs
        </h2>
        <p className="text-text-muted text-sm">
          These are links you submitted for selected Lodges. Open Raidbots for the full simulation;
          Lanternmere does not run or grade it.
        </p>
        {raidbots.data.length === 0 ? (
          <p className="text-text-muted text-sm">
            No report links saved. Add one on a Traveler page.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {raidbots.data.map((report) => (
              <li key={`${report.character_id}-${report.lodge_id}`}>
                <a
                  href={report.report_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  {characterById.get(report.character_id)?.character_name ?? 'Your Traveler'} ·
                  Raidbots report
                </a>{' '}
                <span className="text-text-muted">saved {dateTime(report.updated_at)} UTC</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lodge-panel space-y-5 p-6" aria-labelledby="guild-review-heading">
        <div>
          <h2 id="guild-review-heading" className="font-display text-text-primary text-xl">
            Guild post-raid review
          </h2>
          <p className="text-text-muted text-sm">
            Available to verified Guild leadership. Attendance and loot are Lanternmere records; a
            public log you enter is shown alongside them for human review. The link is not saved or
            treated as proof that it belongs to the selected raid.
          </p>
        </div>
        {!guild ? (
          <p className="text-text-muted text-sm">
            A verified Guild leadership role is needed for this review.
          </p>
        ) : !operationData ? (
          <p role="alert" className="text-sm text-amber-200">
            Guild raid records could not be loaded.
          </p>
        ) : (
          <>
            <form action="/chronicle-lens" className="flex flex-wrap items-end gap-3 text-sm">
              <label className="text-text-muted grid gap-1">
                Guild
                <select
                  name="guild"
                  defaultValue={guild.guild_id}
                  className="lodge-field px-3 py-2"
                >
                  {leaders.map((entry) => (
                    <option key={entry.guild_id} value={entry.guild_id}>
                      {entry.guilds.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="lodge-button-secondary px-4 py-2">
                View Guild
              </button>
            </form>
            <div className="space-y-2">
              <h3 className="text-text-primary font-medium">Dated raid record</h3>
              {operationData.operations.length === 0 ? (
                <p className="text-text-muted text-sm">
                  No Guild raid operations are recorded yet.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {operationData.operations
                    .slice(-20)
                    .reverse()
                    .map((operation) => {
                      const attendance = operationData.attendance.filter(
                        (entry) => entry.operation_id === operation.id,
                      );
                      const present = attendance.filter((entry) =>
                        ['attended', 'late'].includes(entry.attendance_status),
                      ).length;
                      return (
                        <li key={operation.id} className="border-border rounded-lg border p-3">
                          <Link
                            className="text-accent underline"
                            href={`/chronicle-lens?${new URLSearchParams({ guild: guild.guild_id, operation: operation.id })}`}
                          >
                            {operation.title}
                          </Link>
                          <span className="text-text-muted">
                            {' '}
                            · {operation.event_date} · {present} marked attended/late of{' '}
                            {attendance.length} attendance records
                          </span>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
            {selectedOperation && (
              <div className="border-border space-y-4 border-t pt-4">
                <div>
                  <h3 className="text-text-primary font-medium">
                    {selectedOperation.title} · {selectedOperation.event_date}
                  </h3>
                  <p className="text-text-muted text-sm">
                    {selectedOperation.difficulty ?? 'Difficulty not recorded'} ·{' '}
                    {selectedOperation.operational_notes || 'No operational notes'}
                  </p>
                  <Link
                    className="text-accent text-sm underline"
                    href={`/guild-hall/raid-room?${new URLSearchParams({ guild: guild.guild_id, operation: selectedOperation.id })}`}
                  >
                    Open Raid Room details
                  </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-text-primary font-medium">Attendance context</h4>
                    <ul className="text-text-muted text-sm">
                      {['attended', 'late', 'confirmed', 'absent', 'benched'].map((status) => (
                        <li key={status}>
                          {status}:{' '}
                          {
                            operationData.attendance.filter(
                              (entry) =>
                                entry.operation_id === selectedOperation.id &&
                                entry.attendance_status === status,
                            ).length
                          }
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-text-primary font-medium">Loot history</h4>
                    {!loot ? (
                      <p className="text-text-muted text-sm">Loot records could not be loaded.</p>
                    ) : loot.drops.length === 0 ? (
                      <p className="text-text-muted text-sm">No loot recorded.</p>
                    ) : (
                      <ul className="text-text-muted text-sm">
                        {loot.drops.map((drop) => (
                          <li key={drop.id}>
                            {drop.item_name} ·{' '}
                            {loot.awards.some((award) => award.loot_drop_id === drop.id)
                              ? 'award recorded'
                              : 'no award recorded'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <form action="/chronicle-lens" className="grid gap-2 text-sm">
                  <input type="hidden" name="guild" value={guild.guild_id} />
                  <input type="hidden" name="operation" value={selectedOperation.id} />
                  <label htmlFor="public-log" className="text-text-muted">
                    Public Warcraft Logs report link or code
                  </label>
                  <input
                    id="public-log"
                    name="report"
                    defaultValue={reportInput}
                    maxLength={200}
                    className="lodge-field px-3 py-2"
                    placeholder="https://www.warcraftlogs.com/reports/..."
                  />
                  <button type="submit" className="lodge-button-secondary w-fit px-4 py-2">
                    Review public report
                  </button>
                </form>
                {reportInput && !reportCode && (
                  <p role="alert" className="text-sm text-amber-200">
                    Enter a valid public Warcraft Logs report link.
                  </p>
                )}
                {logResult &&
                  (logResult.ok ? (
                    <div className="space-y-2 text-sm">
                      <h4 className="text-text-primary font-medium">
                        Warcraft Logs: {logResult.report.title}
                      </h4>
                      <p className="text-text-muted">
                        Source:{' '}
                        <a
                          className="text-accent underline"
                          href={`https://www.warcraftlogs.com/reports/${logResult.report.code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open original report
                        </a>{' '}
                        · fetched {dateTime(logResult.fetchedAt)} UTC · public reports only
                      </p>
                      <p className="text-text-muted">
                        Report range: {dateTime(logResult.report.startTime)} to{' '}
                        {dateTime(logResult.report.endTime)} UTC
                      </p>
                      <ul className="text-text-muted space-y-1">
                        {(logResult.report.fights ?? [])
                          .filter(
                            (fight): fight is NonNullable<typeof fight> =>
                              fight !== null && fight.encounterID > 0,
                          )
                          .slice(0, 40)
                          .map((fight) => (
                            <li key={fight.id}>
                              {fight.name} · {fight.kill ? 'kill' : 'attempt'} ·{' '}
                              {Math.round((fight.endTime - fight.startTime) / 60000)} minutes
                            </li>
                          ))}
                      </ul>
                      <p className="text-text-muted">
                        The report is external context, not an automatic match to this raid or a
                        judgment of any player.
                      </p>
                    </div>
                  ) : (
                    <p role="alert" className="text-sm text-amber-200">
                      {logResult.message}
                    </p>
                  ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
