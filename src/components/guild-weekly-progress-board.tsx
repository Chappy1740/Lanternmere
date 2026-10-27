'use client';

import { useState } from 'react';
import type { ProgressRow, WeeklyRequirement } from '@/lib/weekly-raider-progress';

const labels: Record<ProgressRow['status'], string> = {
  met: 'Target met · reported',
  remaining: 'Runs or bosses remaining',
  unknown: 'Progress unknown',
  stale: 'Update needed',
  no_target: 'No target set',
};
const value = (number: number | null) => (number === null ? 'Unknown' : String(number));
function timestamp(at: string | null) {
  if (!at || !Number.isFinite(Date.parse(at))) return 'Not available';
  return new Date(at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
function RaiderDetails({ row }: { row: ProgressRow }) {
  return (
    <details className="mt-2 text-left text-sm">
      <summary className="text-accent min-h-8 cursor-pointer">
        View gear and observed activity
      </summary>
      <div className="mt-3 space-y-4 whitespace-normal">
        <p className="text-text-muted">
          {row.snapshotStale ? 'Blizzard snapshot needs refresh:' : 'Blizzard snapshot:'}{' '}
          {timestamp(row.snapshotAt)}. Refresh the Traveler to update it.
        </p>
        <div>
          <h3 className="font-semibold">Observed weekly Mythic+ runs (partial)</h3>
          {row.observedRuns.length ? (
            <ul className="mt-2 space-y-1">
              {row.observedRuns.map((run, i) => (
                <li key={i}>
                  +{run.level} {run.dungeon} · {timestamp(run.completedAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted mt-1">
              No current-week runs available in this snapshot. Total completion is unknown.
            </p>
          )}
        </div>
        <div>
          <h3 className="font-semibold">Observed weekly boss kills (partial)</h3>
          {row.observedBosses.length ? (
            <ul className="mt-2 space-y-1">
              {row.observedBosses.map((boss, i) => (
                <li key={i}>
                  {boss.raid} · {boss.difficulty} · {boss.boss}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted mt-1">
              No current-week kills available in this snapshot. Lockout availability is unknown.
            </p>
          )}
        </div>
        <div>
          <h3 className="font-semibold">Equipped gear</h3>
          {row.equipment.length ? (
            <ul className="mt-2 space-y-2">
              {row.equipment.map((item, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {item.slot}: {item.name}
                  </span>{' '}
                  · iLvl {value(item.itemLevel)}
                  {item.enchants.length > 0 && (
                    <span className="text-text-muted block">{item.enchants.join(' · ')}</span>
                  )}
                  {item.sockets.length > 0 && (
                    <span className="text-text-muted block">{item.sockets.join(' · ')}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted mt-1">Gear not available in the shared snapshot.</p>
          )}
        </div>
        <p className="text-text-muted text-xs">
          Observed runs and last-kill dates can be incomplete. They do not determine total runs,
          raid lockouts or Vault rewards. Upgrade tracks and currencies are not available from this
          snapshot.
        </p>
      </div>
    </details>
  );
}
function Status({ row }: { row: ProgressRow }) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-1 text-xs ${row.status === 'met' ? 'border-emerald-600 text-emerald-200' : row.status === 'remaining' ? 'border-amber-600 text-amber-200' : 'border-border text-text-secondary'}`}
    >
      {labels[row.status]}
    </span>
  );
}
function Vault({ row }: { row: ProgressRow }) {
  return (
    <span>
      Raid {value(row.vault.raid)} · Dungeon {value(row.vault.dungeon)} · World{' '}
      {value(row.vault.world)}
    </span>
  );
}

export function GuildWeeklyProgressBoard({
  rows,
  requirement,
}: {
  rows: ProgressRow[];
  requirement: WeeklyRequirement | null;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const filtered = rows
    .filter(
      (row) =>
        `${row.member} ${row.character ?? ''} ${row.className ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === 'all' ||
          (filter === 'help'
            ? row.status === 'remaining'
            : filter === 'unknown'
              ? ['unknown', 'stale'].includes(row.status)
              : row.status === 'met')),
    )
    .sort((a, b) =>
      sort === 'remaining'
        ? (b.remaining ?? -1) - (a.remaining ?? -1)
        : (a.character ?? a.member).localeCompare(b.character ?? b.member),
    );
  return (
    <section className="lodge-panel min-w-0 p-4 sm:p-6" aria-labelledby="weekly-roster-heading">
      <h2 id="weekly-roster-heading" className="font-display text-text-primary text-2xl font-bold">
        Weekly raider progress
      </h2>
      <p className="text-text-secondary mt-2 text-sm">
        {rows.length} roster rows · {rows.filter((row) => row.status === 'met').length} targets met
        · {rows.filter((row) => row.status === 'remaining').length} with work remaining ·{' '}
        {rows.filter((row) => ['unknown', 'stale'].includes(row.status)).length} unknown or needing
        an update
      </p>
      <p className="text-text-muted mt-2 text-sm">
        {requirement
          ? `${requirement.mythic_runs_required} runs at +${requirement.minimum_key_level} or higher${requirement.raid_bosses_required !== null ? ` and ${requirement.raid_bosses_required} weekly raid boss kills` : ''} per character.`
          : 'Set a weekly target to calculate remaining work.'}{' '}
        Counts and Vault slots below are player-reported. Reports over 24 hours old need an update.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Find a raider
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="border-border bg-background mt-1 min-h-11 w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Show
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="border-border bg-background mt-1 min-h-11 w-full rounded-md border px-3 py-2"
          >
            <option value="all">Everyone</option>
            <option value="help">Work remaining</option>
            <option value="unknown">Unknown or update needed</option>
            <option value="met">Target met</option>
          </select>
        </label>
        <label className="text-sm">
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="border-border bg-background mt-1 min-h-11 w-full rounded-md border px-3 py-2"
          >
            <option value="name">Raider name</option>
            <option value="remaining">Most runs remaining</option>
          </select>
        </label>
      </div>
      <p role="status" className="text-text-muted mt-3 text-sm">
        Showing {filtered.length} of {rows.length} rows.
      </p>
      {!filtered.length && <p className="text-text-secondary mt-4">No raiders match this view.</p>}
      <div className="mt-4 space-y-4 lg:hidden">
        {filtered.map((row) => (
          <article key={row.id} className="border-border min-w-0 rounded-lg border p-4">
            <h3 className="text-text-primary font-semibold">{row.character ?? row.member}</h3>
            <p className="text-text-muted mt-1 text-sm break-words">
              {row.character
                ? `${row.member} · ${row.realm} · ${row.className ?? 'Class unknown'}`
                : 'No shared Traveler in this region or no selected raid character'}
              {row.role ? ` · ${row.role}${row.bench ? ' · Bench' : ''}` : ''}
            </p>
            <div className="mt-3">
              <Status row={row} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-text-muted">Item level</dt>
                <dd>{value(row.itemLevel)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Qualifying runs</dt>
                <dd>
                  {value(row.completed)}
                  {requirement ? ` / ${requirement.mythic_runs_required}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Runs remaining</dt>
                <dd>{value(row.remaining)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Weekly raid kills</dt>
                <dd>
                  {value(row.bosses)}
                  {requirement?.raid_bosses_required != null
                    ? ` / ${requirement.raid_bosses_required}`
                    : ''}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-text-muted">Vault slots unlocked (0–3 each)</dt>
                <dd className="mt-1">
                  <Vault row={row} />
                </dd>
              </div>
            </dl>
            <p className="text-text-muted mt-3 text-xs">Reported: {timestamp(row.reportedAt)}</p>
            <RaiderDetails row={row} />
          </article>
        ))}
      </div>
      <div className="mt-4 hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Selected roster weekly targets, reported completions, Vault slots and freshness
          </caption>
          <thead className="border-border text-text-muted border-b">
            <tr>
              {[
                'Raider / details',
                'iLvl',
                'Runs',
                'Runs left',
                'Raid kills',
                'Vault slots',
                'Status / reported',
              ].map((heading) => (
                <th key={heading} scope="col" className="p-3 align-bottom">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-border border-b align-top">
                <th scope="row" className="min-w-64 p-3 font-normal">
                  <span className="text-text-primary font-semibold">
                    {row.character ?? row.member}
                  </span>
                  <span className="text-text-muted mt-1 block text-xs">
                    {row.character
                      ? `${row.member} · ${row.realm} · ${row.className ?? 'Class unknown'}`
                      : 'Shared Traveler unavailable'}
                    {row.role ? ` · ${row.role}${row.bench ? ' · Bench' : ''}` : ''}
                  </span>
                  <RaiderDetails row={row} />
                </th>
                <td className="p-3">{value(row.itemLevel)}</td>
                <td className="p-3 whitespace-nowrap">
                  {value(row.completed)}
                  {requirement ? ` / ${requirement.mythic_runs_required}` : ''}
                </td>
                <td className="p-3">{value(row.remaining)}</td>
                <td className="p-3 whitespace-nowrap">
                  {value(row.bosses)}
                  {requirement?.raid_bosses_required != null
                    ? ` / ${requirement.raid_bosses_required}`
                    : ''}
                </td>
                <td className="min-w-48 p-3">
                  <Vault row={row} />
                </td>
                <td className="min-w-44 p-3">
                  <Status row={row} />
                  <span className="text-text-muted mt-2 block text-xs">
                    {timestamp(row.reportedAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
