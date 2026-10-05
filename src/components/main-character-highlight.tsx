import Link from 'next/link';
import { getViewer } from '@/lib/hearth/context';
import { loadMainCharacter } from '@/lib/hearth/main-character';
import { CharacterPortrait } from '@/components/character-portrait';
import { CharacterFreshness } from '@/components/character-freshness';
import { CharacterRefreshControl } from '@/components/character-refresh-control';
import { z } from 'zod';
import { raidProgressionEntries } from '@/lib/raiderio-progress';
import { weeklyResetForRegion } from '@/lib/war-table';

const historySchema = z.array(
  z.object({
    mythic_plus_score: z.number().nullable(),
    season_label: z.string().nullable(),
    raid_progression: z.unknown(),
    source_url: z.string().url(),
    refreshed_at: z.string(),
  }),
);
const vaultSchema = z.object({
  raid_progress: z.string().nullable(),
  dungeon_progress: z.string().nullable(),
  world_progress: z.string().nullable(),
});

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(date);
}

const linkClass =
  'text-accent hover:text-accent-hover focus-visible:outline-accent inline-block rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4';

export async function MainCharacterHighlight() {
  const { supabase, user } = await getViewer();
  const result = await loadMainCharacter(supabase, user.id);
  const ready = result.state === 'ready' ? result : null;
  const name = ready?.profile?.name || ready?.character.character_name;
  const reset = ready ? weeklyResetForRegion(ready.character.region) : null;
  const [historyResult, vaultResult] = ready
    ? await Promise.all([
        supabase
          .from('character_raiderio_history')
          .select('mythic_plus_score, season_label, raid_progression, source_url, refreshed_at')
          .eq('character_id', ready.character.id)
          .order('refreshed_at', { ascending: false })
          .limit(8),
        reset
          ? supabase
              .from('weekly_vault_progress')
              .select('raid_progress, dungeon_progress, world_progress')
              .eq('character_id', ready.character.id)
              .eq('reset_on', reset.isoDate)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])
    : [
        { data: [], error: null },
        { data: null, error: null },
      ];
  const parsedHistory = historySchema.safeParse(historyResult.data);
  const history = !historyResult.error && parsedHistory.success ? parsedHistory.data : [];
  const historyUnavailable = Boolean(historyResult.error || !parsedHistory.success);
  const parsedVault = vaultSchema.safeParse(vaultResult.data);
  const vault = !vaultResult.error && parsedVault.success ? parsedVault.data : null;
  const vaultUnavailable = Boolean(vaultResult.error || (vaultResult.data && !parsedVault.success));
  const latest = history[0];
  const raidProgress = raidProgressionEntries(latest?.raid_progression);
  const equipment = ready?.profile?.equipment;
  const raidEncounters = ready?.profile?.raid_encounters;
  const encounterYears = [
    ...new Set(
      (raidEncounters ?? []).flatMap((entry) =>
        entry.last_kill_at ? [entry.last_kill_at.slice(0, 4)] : [],
      ),
    ),
  ].sort();
  const scores = history.filter((point) => point.mythic_plus_score !== null).reverse();
  const topScore = Math.max(1, ...scores.map((point) => point.mythic_plus_score ?? 0));
  const details = ready
    ? [
        ['Level', ready.character.level],
        ['Class', ready.character.class],
        ['Specialization', ready.profile?.active_spec?.name],
        ['Race', ready.profile?.race?.name],
        ['Gender', ready.profile?.gender?.name],
        ['Faction', ready.character.faction],
        ['Equipped item level', ready.profile?.equipped_item_level],
      ].filter(([, value]) => value !== undefined && value !== null && value !== '')
    : [];

  return (
    <section aria-labelledby="main-character-heading" className="space-y-5">
      <div className="lodge-panel p-6 sm:p-8">
        <p className="lodge-kicker">Your champion</p>
        <h1
          id="main-character-heading"
          className="font-display text-text-primary mt-2 text-2xl font-bold"
        >
          Your Main profile
        </h1>
        {ready && name ? (
          <>
            <div className="bg-surface-sunken/35 mt-5 flex items-center gap-4 rounded-lg border border-[color:var(--border-ornate)] p-4">
              <CharacterPortrait
                src={ready.profile?.portrait_url}
                name={name}
                characterClass={ready.character.class}
                gender={ready.profile?.gender?.name}
              />
              <div className="min-w-0">
                <h3 className="font-display text-text-primary text-2xl font-bold [overflow-wrap:anywhere] break-words">
                  {name}
                </h3>
                <p className="text-text-muted mt-1 break-words">
                  {ready.profile?.realm?.name || ready.character.realm_slug} ·{' '}
                  {ready.character.region.toUpperCase()}
                </p>
                <p className="text-text-muted mt-1 text-xs">
                  {ready.ownershipStatusUnavailable
                    ? 'Battle.net ownership status unavailable'
                    : ready.ownershipVerified
                      ? 'Battle.net account verified'
                      : 'Public import · ownership unverified'}
                </p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {details.map(([label, value]) => (
                <div key={label} className="lodge-data-cell">
                  <dt className="text-text-muted text-sm">{label}</dt>
                  <dd className="text-text-primary mt-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="border-border mt-6 space-y-2 border-t pt-4">
              <p className="text-text-muted text-sm">
                Source:{' '}
                {ready.snapshot?.source === 'blizzard'
                  ? 'Blizzard'
                  : ready.snapshot?.source || 'Unavailable'}
              </p>
              <CharacterFreshness
                refreshedAt={ready.snapshot?.last_refreshed_at}
                failedAt={ready.failedAt}
                statusUnavailable={ready.statusUnavailable}
              />
              {ready.snapshotUnavailable && (
                <p className="text-text-muted text-sm">
                  Imported details are temporarily unavailable. Your saved character is still here.
                </p>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-5 text-sm">
              <CharacterRefreshControl
                region={ready.character.region}
                realm={ready.character.realm_slug}
                name={ready.character.character_name}
                returnToHearth
              />
              <Link href={`/travelers/${ready.character.id}`} className={linkClass}>
                Manage {name}
              </Link>
              <Link href="/chronicle-lens" className={linkClass}>
                Full progression history
              </Link>
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-text-muted">
              {result.state === 'empty'
                ? 'A place is waiting for your Main. Add a World of Warcraft character or choose a Main in Travelers.'
                : 'Your Main character could not be loaded right now. You can still visit Travelers and try again.'}
            </p>
            <Link href="/account" className="lodge-button inline-block px-5 py-2.5 text-sm">
              Connect Battle.net and add your Main
            </Link>
          </div>
        )}
      </div>
      {ready && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <section className="lodge-panel p-5" aria-labelledby="gear-summary-heading">
              <h3
                id="gear-summary-heading"
                className="font-display text-text-primary text-lg font-bold"
              >
                Gear summary
              </h3>
              <p className="text-accent mt-3 text-3xl font-semibold">
                {ready.profile?.equipped_item_level ?? '—'}
              </p>
              <p className="text-text-muted text-sm">Equipped item level · Blizzard snapshot</p>
              <p className="text-text-muted mt-3 text-sm">
                {equipment
                  ? `${equipment.length} equipped items · ${equipment.filter((item) => item.enchantments.length > 0).length} with visible enchants`
                  : 'Item details not available in this Blizzard snapshot.'}
              </p>
            </section>
            <section className="lodge-panel p-5" aria-labelledby="upgrades-heading">
              <h3
                id="upgrades-heading"
                className="font-display text-text-primary text-lg font-bold"
              >
                Item upgrades
              </h3>
              <p className="text-text-muted mt-3 text-sm">
                {equipment
                  ? 'Item levels are listed below. Upgrade tracks and crest balances are not available from this import.'
                  : 'Upgrade tracks and crest balances are not available from this import.'}
              </p>
            </section>
            <section className="lodge-panel p-5" aria-labelledby="vault-heading">
              <h3 id="vault-heading" className="font-display text-text-primary text-lg font-bold">
                Great Vault this week
              </h3>
              <p className="text-text-muted mt-1 text-xs">
                Your War Table notes · reset {reset?.isoDate ?? 'unavailable'}
              </p>
              {vaultUnavailable ? (
                <p className="text-text-muted mt-3 text-sm">Vault notes could not be loaded.</p>
              ) : vault ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-text-muted">Raid</dt>
                    <dd className="text-text-primary break-words">
                      {vault.raid_progress || 'No note'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Dungeons</dt>
                    <dd className="text-text-primary break-words">
                      {vault.dungeon_progress || 'No note'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">World</dt>
                    <dd className="text-text-primary break-words">
                      {vault.world_progress || 'No note'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-text-muted mt-3 text-sm">No Vault notes saved for this reset.</p>
              )}
              <Link href="/war-table" className={`${linkClass} mt-4 text-sm`}>
                Open War Table
              </Link>
            </section>
            <section className="lodge-panel p-5" aria-labelledby="score-heading">
              <h3 id="score-heading" className="font-display text-text-primary text-lg font-bold">
                Mythic+ score
              </h3>
              <p className="text-accent mt-3 text-3xl font-semibold">
                {historyUnavailable ? '—' : (latest?.mythic_plus_score ?? '—')}
              </p>
              <p className="text-text-muted text-sm">
                {latest?.season_label || 'Season not recorded'} · Raider.IO snapshot
              </p>
              {latest && (
                <p className="text-text-muted text-xs">Saved {shortDate(latest.refreshed_at)}</p>
              )}
              {latest && (
                <a
                  href={latest.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} mt-4 text-sm`}
                >
                  View source
                </a>
              )}
            </section>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="lodge-panel p-5 sm:p-6" aria-labelledby="keystone-heading">
              <h3
                id="keystone-heading"
                className="font-display text-text-primary text-xl font-bold"
              >
                Keystone progress
              </h3>
              <p className="text-text-muted mt-1 text-sm">
                Saved Raider.IO refreshes, oldest to newest. Gaps mean no saved refresh.
              </p>
              {historyUnavailable ? (
                <p className="text-text-muted mt-5">History could not be loaded.</p>
              ) : scores.length ? (
                <ol
                  className="mt-5 flex h-36 items-end gap-2"
                  aria-label="Mythic plus scores by saved date"
                >
                  {scores.map((point) => (
                    <li
                      key={point.refreshed_at}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 text-center"
                    >
                      <span className="text-text-primary text-xs">{point.mythic_plus_score}</span>
                      <div
                        className="bg-accent w-full max-w-12 rounded-t"
                        style={{
                          height: `${Math.max(8, ((point.mythic_plus_score ?? 0) / topScore) * 90)}%`,
                        }}
                        aria-hidden="true"
                      />
                      <span className="text-text-muted text-xs">
                        {shortDate(point.refreshed_at)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-text-muted mt-5">
                  Refresh Raider.IO on your Traveler page to start a trend.
                </p>
              )}
            </section>
            <section className="lodge-panel p-5 sm:p-6" aria-labelledby="raid-progress-heading">
              <h3
                id="raid-progress-heading"
                className="font-display text-text-primary text-xl font-bold"
              >
                Raid progress
              </h3>
              <p className="text-text-muted mt-1 text-sm">
                {raidEncounters
                  ? 'Blizzard encounter snapshot · kill counts can lag behind play.'
                  : 'Raider.IO summary · Blizzard boss details unavailable.'}
              </p>
              {raidEncounters?.length ? (
                <ul
                  className="mt-4 flex gap-2 overflow-x-auto pb-2"
                  aria-label="Recent raid boss kills"
                >
                  {raidEncounters.slice(0, 12).map((entry, index) => (
                    <li
                      key={`${entry.raid}:${entry.difficulty}:${entry.boss}:${index}`}
                      className="lodge-data-cell max-w-48 min-w-36 shrink-0"
                    >
                      <span className="text-text-primary block text-sm font-medium [overflow-wrap:anywhere] break-words">
                        {entry.boss}
                      </span>
                      <span className="text-text-muted mt-1 block text-xs break-words">
                        {entry.raid} · {entry.difficulty}
                      </span>
                      <span className="text-accent mt-1 block text-sm">
                        {entry.kills} {entry.kills === 1 ? 'kill' : 'kills'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : historyUnavailable ? (
                <p className="text-text-muted mt-5">History could not be loaded.</p>
              ) : raidProgress.length ? (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {raidProgress.map((entry) => (
                    <li key={entry.raid} className="lodge-data-cell min-w-0">
                      <span className="text-text-primary block font-medium break-words">
                        {entry.raid}
                      </span>
                      <span className="text-accent text-sm">{entry.summary}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted mt-5">No raid summary saved for your Main yet.</p>
              )}
            </section>
          </div>
          <section className="lodge-panel p-5 sm:p-6" aria-labelledby="history-gear-heading">
            <h3
              id="history-gear-heading"
              className="font-display text-text-primary text-xl font-bold"
            >
              Raid history
            </h3>
            <p className="text-text-muted mt-2 text-sm">
              {raidEncounters
                ? 'Blizzard reports the latest kill date for each boss and difficulty. This is a saved snapshot, not a complete raid log.'
                : 'Saved Raider.IO raid summaries, newest first. A saved refresh is not proof of a raid on that date.'}
            </p>
            {encounterYears.length > 0 && (
              <ol
                className="mt-4 flex flex-wrap gap-1"
                aria-label="Years with saved raid encounter dates"
              >
                {encounterYears.map((year) => (
                  <li key={year} className="bg-accent/15 text-accent rounded px-2 py-1 text-xs">
                    {year}
                  </li>
                ))}
              </ol>
            )}
            {raidEncounters?.length ? (
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {raidEncounters.slice(0, 20).map((entry, index) => (
                  <li
                    key={`${entry.raid}:${entry.difficulty}:${entry.boss}:${index}`}
                    className="lodge-data-cell min-w-0 text-sm"
                  >
                    <span className="text-text-primary block font-medium [overflow-wrap:anywhere] break-words">
                      {entry.boss} · {entry.difficulty}
                    </span>
                    <span className="text-text-muted mt-1 block break-words">
                      {entry.raid} · {entry.kills} {entry.kills === 1 ? 'kill' : 'kills'}
                      {entry.last_kill_at ? ` · last ${shortDate(entry.last_kill_at)}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            ) : historyUnavailable ? (
              <p className="text-text-muted mt-4 text-sm">Raid history could not be loaded.</p>
            ) : history.length ? (
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {history.map((point) => (
                  <li key={point.refreshed_at} className="lodge-data-cell text-sm">
                    <span className="text-text-primary font-medium">
                      Saved {shortDate(point.refreshed_at)}
                    </span>
                    <span className="text-text-muted mt-1 block break-words">
                      {raidProgressionEntries(point.raid_progression)
                        .map((entry) => `${entry.raid}: ${entry.summary}`)
                        .join(' · ') || 'No raid summary in this snapshot'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-text-muted mt-4 text-sm">No progression snapshots saved yet.</p>
            )}
            <Link href="/chronicle-lens" className={`${linkClass} mt-4 text-sm`}>
              View dated progression history
            </Link>
          </section>
          <section className="lodge-panel p-5 sm:p-6" aria-labelledby="equipment-heading">
            <h3 id="equipment-heading" className="font-display text-text-primary text-xl font-bold">
              Equipment
            </h3>
            {equipment?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <caption className="sr-only">
                    Equipped Blizzard items in the latest saved profile
                  </caption>
                  <thead className="text-text-muted border-border border-b">
                    <tr>
                      <th scope="col" className="p-2">
                        Slot
                      </th>
                      <th scope="col" className="p-2">
                        Item
                      </th>
                      <th scope="col" className="p-2">
                        Enchantments
                      </th>
                      <th scope="col" className="p-2 text-right">
                        Item level
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((item, index) => (
                      <tr
                        key={`${item.slot}:${index}`}
                        className="border-border/60 border-b align-top"
                      >
                        <th
                          scope="row"
                          className="text-text-muted p-2 font-normal [overflow-wrap:anywhere] break-words"
                        >
                          {item.slot}
                        </th>
                        <td className="text-text-primary p-2 [overflow-wrap:anywhere] break-words">
                          {item.name}
                        </td>
                        <td className="text-text-muted p-2 [overflow-wrap:anywhere] break-words">
                          {item.enchantments.join(' · ') || '—'}
                        </td>
                        <td className="text-text-primary p-2 text-right">
                          {item.item_level ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-text-muted mt-2 text-sm">
                Item-by-item gear is unavailable in this Blizzard snapshot. Refresh the profile to
                check again.
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
