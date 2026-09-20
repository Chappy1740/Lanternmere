# Milestone 6 — Adventures & Guild Operations

## Status

In progress.

## Purpose

Give each Lodge a shared place to turn upcoming Quest Board events into a clear picture of the road ahead, while giving Guild Leaders and Raid Leaders a calm, useful view of their guild's readiness, progress, and priorities.

Lanternmere is not intended to become a generic guild-management dashboard. Its leadership tools should help a group prepare, run content, understand progress, and preserve its shared story.

## First delivered slice

- A Lodge-scoped Adventures hub using the canonical Quest Board event data.
- A direct route to plan an event and a concise view of the next six outings.
- Event details continue to own attendance, Travelers, and party-role composition.

No database schema, migration, or RLS change belongs to this first slice. The hub only reads the already private, Lodge-scoped event data.

## Planned scope

### Planning and operations

- recurring event templates and schedules;
- Lodge goals, campaigns, and clear progress or completion states;
- raid, dungeon, route, strategy, and preparation notes;
- leader-focused readiness views that reuse canonical Traveler, RSVP, role, and party-composition data;
- attendance and assignment tools only where their behavior, visibility, and source of truth are explicitly agreed.

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
