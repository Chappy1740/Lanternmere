'use client';

import { useState } from 'react';

type ScorePoint = {
  mythic_plus_score: number | null;
  season_label: string | null;
  refreshed_at: string;
};
type Encounter = {
  raid: string;
  difficulty: string;
  boss: string;
  kills: number;
  last_kill_at: string | null;
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function HearthProgressPanels({
  history,
  encounters,
  unavailable,
}: {
  history: ScorePoint[];
  encounters?: Encounter[];
  unavailable: boolean;
}) {
  const seasons = [...new Set(history.map((point) => point.season_label || 'Season not recorded'))];
  const raids = [...new Set((encounters ?? []).map((entry) => entry.raid))];
  const [season, setSeason] = useState(seasons[0] ?? '');
  const [raid, setRaid] = useState(raids[0] ?? '');
  const [difficulty, setDifficulty] = useState('all');
  const points = history
    .filter(
      (point) =>
        (point.season_label || 'Season not recorded') === season &&
        point.mythic_plus_score !== null,
    )
    .slice()
    .reverse();
  const maxScore = Math.max(1, ...points.map((point) => point.mythic_plus_score ?? 0));
  const chartPoints = points.map((point, index) => ({
    x: points.length === 1 ? 300 : 35 + (index / (points.length - 1)) * 530,
    y: 140 - ((point.mythic_plus_score ?? 0) / maxScore) * 110,
    point,
  }));
  const difficulties = [
    ...new Set(
      (encounters ?? []).filter((entry) => entry.raid === raid).map((entry) => entry.difficulty),
    ),
  ];
  const bosses = (encounters ?? []).filter(
    (entry) => entry.raid === raid && (difficulty === 'all' || entry.difficulty === difficulty),
  );
  const recorded = bosses.filter((entry) => entry.kills > 0).length;

  return (
    <div className="min-w-0 space-y-5">
      <section aria-labelledby="keystone-heading" className="lodge-panel min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="keystone-heading" className="font-display text-text-primary text-xl font-bold">
            Mythic+ score history
          </h3>
          {seasons.length > 0 && (
            <label className="text-text-muted flex min-w-0 flex-wrap items-center gap-2 text-sm">
              Season
              <select
                className="lodge-field max-w-full px-3 py-2"
                value={season}
                onChange={(event) => setSeason(event.target.value)}
              >
                {seasons.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="text-text-muted mt-2 text-sm">
          Up to eight saved Raider.IO scores, oldest to newest. These are refresh dates, not weekly
          dungeon counts.
        </p>
        {unavailable ? (
          <p className="text-text-muted mt-5">History could not be loaded.</p>
        ) : points.length ? (
          <>
            <svg
              viewBox="0 0 600 175"
              role="img"
              aria-labelledby="score-chart-title score-chart-description"
              className="mt-5 h-44 w-full sm:h-52"
            >
              <title id="score-chart-title">{`Saved Mythic+ scores for ${season}`}</title>
              <desc id="score-chart-description">
                {points
                  .map((point) => `${dateLabel(point.refreshed_at)}: ${point.mythic_plus_score}`)
                  .join('; ')}
                . The score scale starts at zero. Exact values are also available in the table
                below.
              </desc>
              {[30, 85, 140].map((y) => (
                <line
                  key={y}
                  x1="35"
                  x2="565"
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-text-muted"
                  opacity="0.2"
                />
              ))}
              <text x="5" y="144" fill="currentColor" className="text-text-muted" fontSize="10">
                0
              </text>
              <text x="5" y="25" fill="currentColor" className="text-text-muted" fontSize="10">
                {maxScore}
              </text>
              <polyline
                points={chartPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-accent"
              />
              {chartPoints.map(({ x, y, point }) => (
                <g key={point.refreshed_at}>
                  <circle cx={x} cy={y} r="4" fill="currentColor" className="text-accent" />
                  <text
                    x={x}
                    y="162"
                    textAnchor="middle"
                    fill="currentColor"
                    className="text-text-muted"
                    fontSize="10"
                  >
                    {dateLabel(point.refreshed_at)}
                  </text>
                </g>
              ))}
            </svg>
            <details className="mt-3">
              <summary className="text-accent cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-offset-4">
                View exact scores
              </summary>
              <table className="mt-2 w-full text-left text-sm">
                <caption className="sr-only">Saved score values and dates in UTC</caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2">
                      Saved date (UTC)
                    </th>
                    <th scope="col" className="py-2">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.refreshed_at} className="border-border border-t">
                      <td className="py-2">
                        {new Date(point.refreshed_at).toLocaleDateString('en-US', {
                          timeZone: 'UTC',
                        })}
                      </td>
                      <td>{point.mythic_plus_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="text-text-muted mt-5">
            Refresh Raider.IO on your Traveler page to start a trend.
          </p>
        )}
      </section>
      {encounters?.length ? (
        <section aria-labelledby="raid-progress-heading" className="lodge-panel min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3
              id="raid-progress-heading"
              className="font-display text-text-primary text-xl font-bold"
            >
              Raid progress
            </h3>
            <div className="flex min-w-0 flex-wrap gap-3">
              <label className="text-text-muted flex min-w-0 flex-wrap items-center gap-2 text-sm">
                Raid
                <select
                  className="lodge-field max-w-full px-3 py-2"
                  value={raid}
                  onChange={(event) => {
                    setRaid(event.target.value);
                    setDifficulty('all');
                  }}
                >
                  {raids.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-text-muted flex flex-wrap items-center gap-2 text-sm">
                Difficulty
                <select
                  className="lodge-field px-3 py-2"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                >
                  <option value="all">All difficulties</option>
                  {difficulties.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <p className="text-text-muted mt-2 text-sm">
            {recorded} of {bosses.length} listed boss/difficulty records have kills. Blizzard
            snapshot; counts can lag behind play.
          </p>
          <ul
            className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-label="Saved raid boss kills"
          >
            {bosses.map((entry, index) => (
              <li
                key={`${entry.difficulty}:${entry.boss}:${index}`}
                className="lodge-data-cell min-w-0"
              >
                <span className="text-text-primary block text-sm font-semibold [overflow-wrap:anywhere]">
                  {entry.boss}
                </span>
                <span className="text-text-muted mt-1 block text-xs">{entry.difficulty}</span>
                <span className="text-accent mt-2 block text-lg">
                  {entry.kills} {entry.kills === 1 ? 'kill' : 'kills'}
                </span>
                {entry.last_kill_at && (
                  <span className="text-text-muted block text-xs">
                    Last {dateLabel(entry.last_kill_at)} (UTC)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
