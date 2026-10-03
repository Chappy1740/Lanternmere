# Milestone 14 — The Lanternkeeper: Assisted Guild Intelligence

## Status

Feature scope implemented October 3, 2026. The verified-leadership read-only briefing and optional aggregate-only AI path are ready. The AI request-budget migration was installed after linked rollback rehearsals and a one-file dry run. Live acceptance remains open under A-15.

## Purpose

Use Lanternmere's own authorized operational data to reduce leadership busywork and summarize what changed, what needs attention, and where to go next.

## Planned scope

- "What changed since last raid?" summaries.
- "Prepare me for tonight's raid" briefing.
- Weekly guild operations briefing.
- Summaries of confirmations, availability, readiness changes, loot history, recruitment/trial status, and stale external snapshots.
- Natural-language navigation into authoritative Lanternmere records.
- Explainable citations/links back to the underlying Lanternmere data wherever practical.

## Guardrails

- Assistance, not autonomous guild leadership.
- No automatic roster cuts, recruitment decisions, disciplinary decisions, loot awards, or player rankings.
- Do not infer private traits, intent, skill, or character from game data.
- Respect the same RLS, permissions, sharing, and consent boundaries as the underlying records.
- Generated summaries must distinguish known facts from suggestions and missing/stale data.

## Architecture reference

Implementation of this milestone must follow [Lanternkeeper AI Architecture](../lanternkeeper-ai-architecture.md). Milestones 7–13 should preserve structured, permission-aware, provenance-rich data so the future assistant can use narrow domain tools rather than unrestricted database access.

## First release boundaries

- The dedicated page provides weekly, next-raid, and since-last-raid views for currently verified Guild leaders. Each read uses the viewer's Supabase session and rechecks verified leadership; each fact links to its source screen.
- Fixed destination search helps users find Guild Hall, Muster, Artisan Hall, War Table, Chronicle Lens, or Supply Chest. It never forms arbitrary database queries or external URLs.
- AI wording is optional and user-triggered. The model sees only an explicit allowlist of aggregate counts and freshness notes. It cannot call tools or write records. Guild names, event titles, applicant content, private notes, member names, and links remain in Lanternmere. Will approved this aggregate-only OpenAI path on October 3.
- The installed database migration enforces six requests per user per hour and 40 per Guild per day, stores metadata without prompts or responses, and deletes metadata after 30 days. The optional provider key is not configured or live-tested.
- The app does not yet have a canonical Guild boss-kill record. Chronicle Lens can inspect a manually supplied public Warcraft Logs report, but that report is not automatically tied to a Guild raid. The Lanternkeeper identifies this as missing rather than claiming a kill.
- WoWAudit's application experience and boss-kill front dashboard are accepted design references for a later UX patch. WoWAudit advertises a public team API, but there is no API connection or data import in this release.
