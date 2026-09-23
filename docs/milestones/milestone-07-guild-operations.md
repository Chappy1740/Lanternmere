# Milestone 7 — The Guild Hall: Guild Operations

## Status

Complete.

## Purpose

Make Lanternmere a one-stop World of Warcraft guild operations platform for guild members, raid leaders, officers, loot councils, and guild leaders while preserving the Lodge identity, player agency, privacy boundaries, and existing canonical records.

Milestone 7 establishes Guilds as a first-class Lanternmere workspace rather than treating guild leadership as an extension of Adventures.

## Product principle

Lanternmere should help a guild prepare, organize, make informed decisions, preserve history, and reduce leadership overhead without automatically deciding who deserves loot, who should raid, or how a guild must operate.

Guild rules remain configurable. Leadership decisions remain human decisions.

## Core scope

### Guild Hall

- Dedicated guild workspace and dashboard.
- Guild identity, progression summary, upcoming raid or event context, readiness indicators, and operational alerts.
- Fast paths into roster, raids, readiness, attendance, and guild settings.

### Guild membership and roster

- Support multiple guilds per Lanternmere account.
- Represent guild membership separately from general Lodge or Traveler relationships.
- Track members, mains and alts, ranks, raid roles, specs, status, and relevant guild-facing character data.
- Preserve character ownership and existing selected-Lodge sharing boundaries where applicable.

### Guild roles and permissions

Plan explicit application permissions for at least:

- guild member;
- raid leader;
- loot council member;
- officer;
- guild administrator / guild master.

Permissions must be enforced server-side and with Supabase RLS where stored data requires it. UI visibility alone is not authorization.

### Raid planning

- Create or manage a guild raid operation using canonical event data where possible.
- Select attending roster, bench, tanks, healers, DPS, and leadership roles.
- Preserve canonical Quest Board event and RSVP records instead of duplicating them.
- Allow raid-specific notes, assignments, and operational context only after their source of truth and visibility rules are defined.

### Raid readiness

Provide leadership views that can summarize, where supported and consented:

- character item level;
- role / spec;
- tier progress;
- Great Vault progress;
- Mythic+ progress or score;
- gear freshness;
- missing gems or enchants when a reliable supported data source exists;
- readiness notes;
- last refresh time and stale-data state.

Readiness is information for planning, not an automated judgment about whether a person should be allowed to raid.

### Attendance

- Track invited, confirmed, attended, late, absent, and benched states where behavior is explicitly defined.
- Separate attendance history from punitive scoring.
- Preserve auditability of leadership edits.
- Design reporting so context remains visible and leadership retains discretion.

### Loot Council and award history

Loot Council workflow, awards, and award history are Milestone 8 work. They must remain human-controlled, auditable, and tied to the Guild and canonical event foundations established here; Lanternmere must never automatically choose a recipient.

### Guild settings

- Guild identity and configuration.
- Leadership roles and permissions.
- Loot-council membership and loot-policy configuration.
- External integration / refresh preferences.
- Guild-specific operational defaults.
- Clear leave, removal, revocation, and ownership-transfer behavior before destructive actions are implemented.

## External data strategy

Guild Operations should consume cached Lanternmere snapshots instead of requiring live third-party calls every time a page opens.

Preferred flow:

1. Render the last successful Lanternmere snapshot immediately.
2. Display source, freshness, and failure state.
3. Allow supported manual refresh when permitted.
4. Respect provider rate limits and attribution requirements.
5. Preserve previous successful data if an upstream refresh fails.

A 24-hour refresh window remains the default direction for external character or guild summaries unless a provider's supported integration path requires something different.

## Integration candidates

### Blizzard / Battle.net

Use official APIs for supported character and guild information where available. Keep secrets server-side and maintain explicit region / realm / character identity.

### Raider.IO

Reuse the Milestone 6 manually refreshed snapshot architecture where appropriate for Mythic+ and raid-progression summaries.

### Warcraft Logs

Explore supported, attributed, opt-in guild and raid progression data for boss history, raid runs, and operational review.

### Raidbots

Treat Raidbots as a player-submitted or supported handoff unless an approved integration path exists. Do not scrape, automate unsupported simulations, or present simulation output as a universal truth.

## Professions and guild services

The data model should leave room for later guild-service workflows such as:

- character professions;
- specializations;
- notable recipes;
- crafting capabilities;
- guild crafting requests;
- "who can craft this?" discovery.

These may ship after the Milestone 7 foundation if their supported data sources and workflow rules are not ready.

## Architecture requirements

- Multi-guild capable from the start; do not hardcode one guild per account or one guild per Lodge.
- Keep guild membership, permissions, raids, attendance, loot, and external snapshots normalized enough to scale independently.
- Reuse canonical Traveler, character, Quest Board event, RSVP, role, and existing snapshot data where possible.
- Avoid duplicating facts already owned by another Lanternmere domain.
- Preserve server-verified character ownership for privileged character changes.
- Preserve RLS and selected-sharing boundaries.
- Treat external data as timestamped snapshots with explicit provenance.
- Design mutations to be auditable where leadership decisions or history are involved.
- Mobile and desktop layouts must remain usable for real raid-night workflows.

## First implementation target

The first Milestone 7 release should establish:

1. Guild creation / joining foundation.
2. Guild membership and application roles.
3. Guild Hall dashboard shell.
4. Guild roster.
5. Raid planning foundation.
6. Raid readiness foundation.
7. Attendance foundation.
8. Guild settings and permissions.
9. Cached external-data model suitable for later integrations.

Advanced analytics, profession services, deeper Warcraft Logs views, richer Raidbots workflows, and extended reporting may follow after this foundation is stable.

## Discovery required before implementation

Before schema or application code begins:

- verify current Blizzard, Raider.IO, Warcraft Logs, and Raidbots supported integration paths, terms, rate limits, attribution, and data-retention requirements;
- define the relationship between Lodges and Guilds without assuming they are identical;
- define guild creation, joining, invitations, ownership, and multi-guild membership behavior;
- define each guild application role and its permissions;
- define raid, attendance, assignment, loot-council, and award sources of truth;
- define player consent, sharing, refresh, revocation, and stale-data behavior;
- decide what data can be inferred from external providers versus what must be player- or leader-entered;
- identify migration and RLS impacts before adding tables.

## Guardrails

- Guild Operations is a first-class product area, not one giant page.
- Do not overload Adventures with guild-management behavior.
- Do not duplicate canonical event, RSVP, Traveler, Chronicle, or achievement records.
- Do not expose private character or guild data merely because a user has a leadership title in the UI.
- Do not make third-party scores, logs, simulations, attendance percentages, or item-level differences automatic requirements.
- Do not auto-award loot or rank players.
- Keep leadership decisions explainable, auditable, and human-controlled.
- Preserve Lanternmere's atmospheric identity while prioritizing clear raid-night usability.
