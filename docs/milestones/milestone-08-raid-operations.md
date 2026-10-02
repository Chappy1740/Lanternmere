# Milestone 8 — The Raid Room: Raid Operations

## Status

Feature scope implemented — September 23, 2026. Security acceptance remains open until the
Battle.net Guild Master claim flow is exercised with a real rank-0 account and a second member
account. Unverified Guild leadership is locked as of September 28, 2026.
Loot Council-only members have a scoped workspace for linked raid titles/dates and loot decisions
without gaining Raid Mode roster, encounter, or Lodge access. Live role and operation acceptance
remains pending a verified Guild Master and a second account.

## Purpose

Turn a Guild's scheduled raid into a focused operational workspace for raid leaders and raiders.

## Planned scope

- Raid Mode with a low-clutter raid-night interface.
- Smart roster builder showing role balance, melee/ranged mix, class/spec context, and supported raid utility coverage.
- Availability and bench management.
- Encounter workspaces for strategy, assignments, interrupts, cooldowns, markers, and notes.
- Attendance capture tied to canonical raid/event records.
- Loot Council operational flow: drop, candidates, interest, factual comparison, votes, award, reason, and history.
- Mobile/tablet usability for leaders who are not sitting at the primary game screen.

## Guardrails

- Lanternmere provides decision support; it does not automatically choose a raid roster or loot recipient.
- Reuse Milestone 7 guild membership, permissions, and attendance foundations.
- Do not duplicate Quest Board events or RSVP records.
- Encounter and assignment data must have explicit authorship, visibility, and audit behavior.
