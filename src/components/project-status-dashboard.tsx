'use client';

import { useEffect, useState } from 'react';
import { projectProgress, type ProjectTracker } from '@/lib/project-status';

type StatusResponse = {
  tracker: ProjectTracker;
  source: 'published main' | 'bundled snapshot';
};

const milestoneState = {
  implemented: 'Implemented',
  in_progress: 'In progress',
  planned: 'Planned',
};

const workState = {
  done: 'Done',
  in_progress: 'In progress',
  todo: 'To build',
};

const requestState = {
  proposed: 'Proposed',
  accepted: 'Accepted',
  in_progress: 'In progress',
  done: 'Done',
  declined: 'Declined',
};

export function ProjectStatusDashboard({ initialTracker }: { initialTracker: ProjectTracker }) {
  const [tracker, setTracker] = useState(initialTracker);
  const [source, setSource] = useState<'published main' | 'bundled snapshot'>('bundled snapshot');

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch('/api/project-status', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as StatusResponse;
        if (active && data.tracker.revision >= initialTracker.revision) {
          setTracker(data.tracker);
          setSource(data.source);
        }
      } catch {
        // Keep the last usable snapshot visible during a connection failure.
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [initialTracker.revision]);

  const progress = projectProgress(tracker);
  const activeMilestone = tracker.milestones.find(
    (milestone) => milestone.status === 'in_progress',
  );
  const activeDone = activeMilestone?.work.filter((item) => item.status === 'done').length ?? 0;
  const plannedMilestones = tracker.milestones.filter(
    (milestone) => milestone.status === 'planned',
  );
  const openAcceptance = tracker.acceptance.filter((item) => item.status === 'open');

  return (
    <div className="space-y-8">
      <header>
        <p className="lodge-kicker">Development roadmap</p>
        <h1 className="font-display text-text-primary mt-2 text-3xl font-semibold sm:text-4xl">
          Project status
        </h1>
        <p className="text-text-muted mt-3 max-w-3xl leading-relaxed">
          What is built, what is next, and what has been added to the plan. Updated from the
          published project tracker every five minutes while this page is open.
        </p>
      </header>

      <section aria-label="Overall roadmap progress" className="lodge-panel p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="lodge-kicker">Overall feature scope</p>
            <p className="font-display text-accent mt-2 text-5xl font-semibold">
              {progress.percent}%
            </p>
            <p className="text-text-muted mt-2 text-sm">
              {progress.implemented} of {progress.total} roadmap milestones implemented
            </p>
          </div>
          <div className="text-text-muted text-sm sm:text-right">
            <p>Tracker updated {tracker.updatedAt}</p>
            <p>Source: {source}</p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Implemented roadmap milestones"
          aria-valuenow={progress.implemented}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          className="bg-surface-sunken border-border mt-6 h-3 overflow-hidden rounded-full border"
        >
          <div
            className="bg-accent h-full rounded-full"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="text-text-muted mt-4 text-xs leading-relaxed">
          Each milestone counts once. This measures implemented scope, not elapsed time or live
          acceptance. New requests assigned to a milestone are added to its work before it can be
          marked implemented.
        </p>
      </section>

      {activeMilestone && (
        <section className="lodge-panel p-5 sm:p-7" aria-labelledby="current-milestone">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="lodge-kicker">Current milestone · {activeMilestone.number}</p>
              <h2 id="current-milestone" className="font-display mt-2 text-2xl">
                {activeMilestone.name}
              </h2>
            </div>
            <span className="text-accent rounded-full border border-[color:var(--border-ornate)] px-3 py-1 text-xs">
              {activeDone} of {activeMilestone.work.length} tracked items done
            </span>
          </div>
          <ul className="mt-5 grid gap-2">
            {activeMilestone.work.map((item) => (
              <li
                key={item.id}
                className="lodge-list-row flex flex-wrap items-start justify-between gap-2 px-4 py-3"
              >
                <span className="text-sm">{item.title}</span>
                <span
                  className={
                    item.status === 'done' ? 'text-xs text-green-300' : 'text-text-muted text-xs'
                  }
                >
                  {workState[item.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="future-milestones">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 id="future-milestones" className="font-display text-2xl">
            Still to create
          </h2>
          <span className="text-text-muted text-sm">
            {plannedMilestones.length} planned milestones
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {plannedMilestones.map((milestone) => (
            <details key={milestone.number} className="lodge-panel group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="lodge-kicker">
                    Milestone {milestone.number} · {milestoneState[milestone.status]}
                  </span>
                  <span className="font-display mt-1 block text-lg">{milestone.name}</span>
                </span>
                <span aria-hidden="true" className="text-accent text-xl group-open:rotate-45">
                  +
                </span>
              </summary>
              <ul className="text-text-muted mt-4 list-inside list-disc space-y-2 text-sm">
                {milestone.work.map((item) => (
                  <li key={item.id}>{item.title}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="lodge-panel p-5 sm:p-6" aria-labelledby="change-requests">
          <p className="lodge-kicker">Scope changes</p>
          <h2 id="change-requests" className="font-display mt-2 text-xl">
            Requests added during the build
          </h2>
          <ul className="mt-4 space-y-3">
            {tracker.requests.map((request) => (
              <li key={request.id} className="lodge-list-row p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="font-medium">{request.title}</strong>
                  <span className="text-accent text-xs">{requestState[request.status]}</span>
                </div>
                <p className="text-text-muted mt-2">{request.note}</p>
                <p className="text-text-muted mt-2 text-xs">
                  {request.id} · Requested {request.requestedAt} ·{' '}
                  {request.milestone === null
                    ? 'Milestone pending'
                    : `Milestone ${request.milestone}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section className="lodge-panel p-5 sm:p-6" aria-labelledby="acceptance-checks">
          <p className="lodge-kicker">Validation</p>
          <h2 id="acceptance-checks" className="font-display mt-2 text-xl">
            Open acceptance checks
          </h2>
          <p className="text-text-muted mt-2 text-sm">
            Feature implementation can be complete while these live checks remain open.
          </p>
          <ul className="mt-4 space-y-2">
            {openAcceptance.map((item) => (
              <li key={item.id} className="lodge-list-row px-4 py-3 text-sm">
                {item.title}
              </li>
            ))}
            {openAcceptance.length === 0 && (
              <li className="text-text-muted text-sm">No open acceptance checks recorded.</li>
            )}
          </ul>
        </section>
      </div>

      <p className="text-text-muted pb-8 text-sm">
        Detailed scope and evidence live in the{' '}
        <a
          className="text-accent underline underline-offset-4"
          href="https://github.com/Chappy1740/Lanternmere/blob/main/docs/milestones/ROADMAP.md"
        >
          roadmap
        </a>{' '}
        and{' '}
        <a
          className="text-accent underline underline-offset-4"
          href="https://github.com/Chappy1740/Lanternmere/blob/main/docs/project-status.md"
        >
          project handoff
        </a>
        .
      </p>
    </div>
  );
}
