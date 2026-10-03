# Milestone 13 — The Chronicle Lens: Progression Intelligence

## Status

Feature scope implemented October 3, 2026. The first release adds owner-only timestamped Raider.IO history, a supported Warcraft Logs public-report lookup through private client credentials, existing player-submitted Raidbots handoffs, and a verified-leadership post-raid review using canonical raid operations, attendance, and loot. The migration is installed and synthetic rollback checks passed before and after installation. Real-account acceptance, live Warcraft Logs credentials, and independent audit remain open.

## Purpose

Bring useful progression context from specialist services into Lanternmere without trying to replace those services.

## Planned scope

- Warcraft Logs raid/run and boss-progression context through a supported integration.
- Raider.IO seasonal and dungeon context using the existing snapshot pattern.
- Player-submitted or supported Raidbots report handoffs.
- Guild and character trend views using timestamped snapshots.
- Post-raid review that connects raid history, attendance context, loot history, and supported progression data.
- Clear source attribution and links to the original specialist service.

## Guardrails

- No unsupported scraping.
- No universal player ranking or automated performance verdicts.
- Preserve source, timestamp, consent, revocation, stale-data, and failure states.
- Specialist sites remain authoritative for their specialized analysis.

## First-release choices

- A Traveler owner sees historical Raider.IO refresh points, current-season score labels, best dungeon runs, and raid-progression summaries. Lodge or Guild sharing of the current readiness snapshot does not grant access to this detailed history. Refreshes remain at most once per 24 hours; a failed refresh does not add a history point. Deleting the Traveler deletes the history.
- Warcraft Logs lookup accepts a public report URL or code, uses the official OAuth client-credentials flow on the server, and requests the public GraphQL API with unlisted access disabled. Private reports require a different permission flow and are outside this release. Missing credentials or upstream failures appear as clear unavailable states. The report link is not saved.
- Verified Guild leadership may select one existing Guild raid operation and compare its dated attendance and loot records with a public report entered for that review. Lanternmere does not assert that the report belongs to that operation; the leader must verify the match on Warcraft Logs.
- Existing member-submitted Raidbots links are shown to their owner as handoffs to the specialist service. Lanternmere does not run Raidbots simulations.
- Dated raid operations show attendance counts as a Guild activity timeline. Raider.IO character history shows saved refresh points, not a continuous activity log. Neither timeline grades players or infers performance from missing data.

## Configuration

`WARCRAFT_LOGS_CLIENT_ID` and `WARCRAFT_LOGS_CLIENT_SECRET` are optional server-only variables. Both are required for public report lookup. Create a Warcraft Logs OAuth client and keep these values in the private local environment or Workers secrets; never add them to `NEXT_PUBLIC_` variables or source. See the [official API documentation](https://www.warcraftlogs.com/api/docs).
