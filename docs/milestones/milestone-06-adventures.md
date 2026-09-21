# Milestone 6 — Adventures

## Status

In progress.

## Purpose

Give each Lodge a shared place to turn upcoming Quest Board events into a clear picture of the road ahead. Adventures focuses on recurring plans, campaigns and goals, preparation context, and opt-in external progress summaries that enrich Lodge planning without duplicating canonical event, RSVP, Traveler, Chronicle, or achievement records.

Dedicated guild-management workflows are intentionally separated into Milestone 7 — The Guild Hall: Guild Operations.

## First delivered slice

- A Lodge-scoped Adventures hub using the canonical Quest Board event data.
- A direct route to plan an event and a concise view of the next six outings.
- Event details continue to own attendance, Travelers, and party-role composition.

No database schema, migration, or RLS change belongs to this first slice. The hub only reads the already private, Lodge-scoped event data.

## Recurring plans slice

- Lodge members can save shared weekly recurring plans with an optional UTC time, activity, difficulty, and preparation notes.
- A recurring plan is a reusable prompt, not an automatic scheduler: a member explicitly chooses a date and posts the resulting canonical Quest Board event.
- Plans are visible to Lodge members and removable by their author or a Lodge owner/caretaker. They do not duplicate event, RSVP, Traveler, or party-composition data.
- The `event_templates` table is private to the Lodge through RLS and preserves its Lodge and author identity after creation.

## Campaigns and goals slice

- Lodge members can begin a manually maintained campaign with an optional focus and numeric goal.
- Authors and Lodge owners/caretakers can maintain its progress and set it active, completed, or archived.
- Campaigns remain Lodge-private and do not infer progress from external services or create work assignments.

## Raider.IO refresh slice

- A Traveler owner may manually refresh that Traveler's public Raider.IO Mythic+ and raid-progression summary. The request is made only by server code, never by the browser with a secret or an unsupported scrape.
- Refreshes are limited to once per 24 hours per Traveler. A rate-limit, not-found, or upstream failure returns a safe message; a previous successful snapshot remains intact and records the latest failure when possible.
- Owners can explicitly share or revoke a saved summary with each selected Lodge. Each successful snapshot shows its Raider.IO source link and UTC refresh time.
- Lodge owners and caretakers see only consented snapshot identity, Mythic+ score, freshness, last refresh failure, and the attributed source link in Adventures. They do not gain access to the broader Traveler profile through this view.

## Planned scope

### Adventure planning

- raid, dungeon, route, strategy, and preparation notes;
- Lodge-scoped planning views that reuse canonical Traveler, RSVP, role, and party-composition data;
- hand off guild-specific readiness, attendance, assignments, loot, and leadership workflows to Milestone 7 rather than duplicating them here.

### External progress integrations

- Warcraft Logs progress: surface opted-in raid-run, boss-kill, and progression history in a Lodge context;
- Raider.IO progress: surface opted-in Mythic+ score, seasonal progress, and dungeon-run context;
- begin with read-only, manually refreshed data and an explicit consent/connection model; defer automatic synchronization until its operational, privacy, and API implications are approved;
- use external data to enrich the Lodge's shared progress story rather than replace the canonical event, Traveler, Chronicle, or achievement records.

### Weekly readiness and Raidbots handoff

- provide a player-submitted weekly gear-plan record, starting with a completed Raidbots Top Gear or Droptimizer report link, its update time, and concise player-authored upgrade targets;
- give leaders a roster-level view of submitted readiness and upgrade priorities, with links back to the original player report;
- do not submit simulations to, scrape, or represent Lanternmere as an automated Raidbots client without a supported, reviewed integration path;
- present all gear recommendations as character-specific advice, not universal requirements. Tank, healer, encounter, talent, and player-skill context must remain visible in leader review.

## Discovery required before implementation

- Confirm current Warcraft Logs, Raider.IO, and Raidbots terms, supported integration paths, data ownership, rate limits, and attribution requirements.
- Define who can connect or refresh each data source, what is visible to Lodge roles, how a player revokes access, and how stale/external-data failures are presented.
- Agree the source of truth for assignments and readiness notes before adding schema or automation.

## Guardrails

- Reuse canonical Quest Board records rather than duplicating event or RSVP data.
- Preserve Lodge privacy, explicit selected-Lodge scoping, and existing RLS boundaries.
- Treat external integrations as opt-in, read-only by default, and clearly timestamped; never make a third-party score or sim result an implicit requirement.
- Keep the room atmospheric and planning-oriented; avoid a generic project-management dashboard.

## Milestone completion gate — Lanternkeeper readiness

Milestone 6 remains in progress until its agreed Adventures scope is complete. Before Milestone 6 is closed and Milestone 7 begins, perform a targeted Lanternkeeper readiness audit across Milestones 1–6.

This is an audit and targeted-refactor gate, not a requirement to rebuild completed milestones or add AI calls early.

Verify:

- important operational facts are stored as structured records/fields rather than only presentation text;
- reusable server-side loaders/services can expose authorized domain data without requiring future AI code to duplicate page logic or use arbitrary database access;
- ownership, Lodge membership, selected-Lodge sharing, server authorization, and RLS boundaries remain enforceable for every potentially AI-readable record;
- external/imported data preserves provider/source, refresh timestamp, consent/sharing state, freshness/staleness, and safe failure state where applicable;
- canonical records have stable identifiers and relationships suitable for links/citations back to authoritative Lanternmere screens;
- user-authored notes and external content can be treated as untrusted data rather than application/model instructions;
- no AI provider, chat persistence, embeddings, model calls, or AI-specific schema is added merely to satisfy this audit.

Record any findings as no-change, targeted refactor, or deferred Milestone 7+ work. Fix only issues that materially affect security, provenance, reuse, or future Lanternkeeper compatibility.

Milestone 6 may be marked complete only after the remaining Adventures scope and this readiness audit are both complete and documented.
