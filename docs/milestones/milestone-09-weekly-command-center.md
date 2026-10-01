# Milestone 9 — The War Table: Weekly Command Center

## Status

Feature scope implemented September 30, 2026. Remote migrations are applied. Merge, deployment, and live acceptance are tracked in `docs/project-status.md`.

## Purpose

Give each player and guild leader a concise answer to: "What matters this week?"

## Planned scope

- Personalized weekly player dashboard.
- Leadership command view for upcoming raids, confirmation gaps, readiness, stale data, Vault progress, and operational follow-ups.
- Weekly reset-aware presentation.
- Player availability and planned absences.
- Guild calendar covering raids, Mythic+, alt runs, achievement runs, meetings, social events, and trials.
- Calendar export/subscription where technically appropriate.
- Action-oriented summaries that link to the authoritative Lanternmere workflow instead of duplicating it.

## Guardrails

- Surface facts and outstanding actions without punitive scoring or automatic leadership judgments.
- Prefer existing canonical data and cached snapshots.
- Clearly label stale or externally sourced data.

## Delivered behavior

- The War Table works for Lodge and Guild-only accounts. The selected Lodge's canonical events show personal RSVP gaps, while Guild-owned non-raid plans cover Mythic+, alt runs, achievement runs, meetings, social events, and trials.
- Verified Guild leadership sees authorized raid operations, selected-member confirmation gaps, unassigned tasks, availability signals, consented readiness, official-roster freshness, and explicitly shared player-entered Vault notes. Raid operations link to Raid Mode and preserve Quest Board ownership of events and RSVPs.
- Players record and remove dated Guild availability. They can record private notes for their Main character's upcoming regional reset and opt into sharing those notes with each Guild's verified leadership separately.
- Authenticated `.ics` downloads export the requesting member's accessible Lodge events or Guild-owned plans. These are one-time snapshots. A public subscription URL is inappropriate for private Lodge and Guild plans without a separate revocable authorization model.
- Weekly reset dates account for the appropriate regional time zone and daylight saving changes. Unsupported character regions are shown as unavailable.
