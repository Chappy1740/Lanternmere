# Milestone 6 — Adventures

## Status

In progress.

## Purpose

Give each Lodge a shared place to turn upcoming Quest Board events into a clear picture of the road ahead.

## First delivered slice

- A Lodge-scoped Adventures hub using the canonical Quest Board event data.
- A direct route to plan an event and a concise view of the next six outings.
- Event details continue to own attendance, Travelers, and party-role composition.

No database schema, migration, or RLS change belongs to this first slice. The hub only reads the already private, Lodge-scoped event data.

## Future scope to agree before implementation

- recurring event templates and schedules;
- Lodge goals or campaigns;
- route, strategy, or preparation notes;
- progress states and completion criteria.

## Guardrails

- Reuse canonical Quest Board records rather than duplicating event or RSVP data.
- Preserve Lodge privacy, explicit selected-Lodge scoping, and existing RLS boundaries.
- Keep the room atmospheric and planning-oriented; avoid a generic project-management dashboard.
