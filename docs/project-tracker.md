# Project status tracker

[`project-tracker.json`](project-tracker.json) supplies the public `/status` page. The page checks the published `main` copy every five minutes and shows a bundled copy if GitHub is unavailable. Changes become visible after they are committed and pushed to `main`; local edits and chat messages alone cannot update the published page.

## Roadmap display

Each milestone includes a concise `description` and the filename of its `specification` in `docs/milestones/`. The status page shows all milestones in numerical order, marks the first planned milestone as next, and expands each card to show tracked tasks and linked requests. Keep these descriptions aligned with the milestone specifications when scope changes.

## Counting rule

The overall percentage is **implemented milestones / all roadmap milestones**. Each milestone counts once, so the current baseline is 11 / 15 = approximately 73%. This is feature-scope progress, not a time estimate or a claim that live acceptance has passed. The active milestone's work items and the separate acceptance list provide the finer detail. A new request assigned to a milestone is added to that milestone's work list; it must be finished before the milestone is marked implemented.

## Updating the tracker

When the user adds or changes scope during a milestone build:

1. Add a `CR-...` entry to `requests` with the original request date, destination milestone (or `null` pending placement), and `proposed`, `accepted`, `in_progress`, `done`, or `declined` status. Preserve the user's intent in plain language.
2. Once accepted, add any deliverable to the target milestone's `work` list. Keep request status and deliverable status aligned. Record scope decisions in the relevant milestone specification and `docs/project-status.md` when they change implementation status.
3. Update work item states from actual implementation evidence, not navigation labels or plans. Keep live validation gaps in `acceptance` until checked. Mark a milestone `implemented` only when its accepted work is done.
4. Increment `revision`, set `updatedAt`, review the diff, and push the focused change to `main` through the normal Git workflow. Do not claim the public dashboard is current until that happens.

The tracker is a concise public summary. The milestone specifications and `docs/project-status.md` remain the detailed source of truth. Do not add private account data, credentials, or internal security details here.
