# Milestone 6 — Adventures

## Status

Complete.

## Purpose

Give each Lodge a shared picture of the road ahead without duplicating canonical Quest Board events, RSVPs, Travelers, Chronicles, or achievement records. Adventures is a planning and consented-progress context; guild-management operations remain Milestone 7 work.

## Delivered scope

### Lodge planning

- A Lodge-scoped Adventures hub presents the next six canonical Quest Board events and routes members to event planning and party composition.
- Recurring plans save a reusable weekly event prompt with optional UTC time, activity, difficulty, and preparation notes. Members explicitly choose a date and post the resulting canonical event; plans never schedule events automatically.
- Manually maintained Lodge-private campaigns store an optional focus, numeric target, progress count, and active, completed, or archived state. They do not infer external progress or create assignments.
- Strategy and preparation are canonical Quest Board event notes. Templates can prefill those notes, create and edit persist them, and event detail renders them as **Strategy and preparation**. Adventures deliberately has no second notes system.

### Opt-in external progress context

- A Traveler owner can manually refresh a public Raider.IO Mythic+ and raid-progression snapshot through server code. Refreshes are limited to once per 24 hours; previous successful data remains available when an upstream request fails.
- Raider.IO snapshots retain source attribution, UTC refresh time, freshness, consented selected-Lodge sharing, and safe failure state. Lodge owners and caretakers see only consented snapshot identity, Mythic+ score, freshness, latest safe failure message, and source link—not a broader Traveler profile.
- A Traveler owner can share an existing Raidbots report link and optional player-authored upgrade targets with a selected Lodge. Lanternmere does not submit simulations, scrape reports, or make Raidbots requests. Leaders receive the consented identity, targets, update time, and link back to the original report.

## Scope boundary and deferral

Guild readiness, attendance, assignments, loot, leadership workflows, and multi-guild operations are deferred to Milestone 7 — The Guild Hall: Guild Operations.

Warcraft Logs live integration is not implemented. It requires a supported OAuth/client-credential integration, including an approved client registration and credentials. Lanternmere does not scrape Warcraft Logs and does not store placeholder credentials. Deeper Warcraft Logs work is deferred to Milestone 13 — The Chronicle Lens: Progression Intelligence, alongside supported progression and trend views.

## Lanternkeeper readiness audit

**Result: no material architecture refactor required.** A targeted review across Milestones 1–6 found that the current architecture already provides:

- structured domain records and stable IDs;
- reusable server-only loaders and services;
- Zod and input validation;
- authentication, ownership, Lodge membership, selected-Lodge sharing, and RLS boundaries;
- source, provenance, freshness, consent, and safe-failure information for external snapshots;
- canonical relationships suitable for future Lanternkeeper links and citations; and
- user-authored and external text that can remain untrusted data rather than model instructions.

This audit added no AI APIs, model credentials, embeddings, vector storage, chat tables, AI-specific database schema, or Lanternkeeper runtime code. Future Lanternkeeper work remains Milestone 14 work and must preserve these authorization and provenance boundaries.

## Guardrails preserved

- Reuse canonical Quest Board, RSVP, Traveler, Chronicle, and achievement records rather than duplicate them.
- Preserve Lodge privacy, explicit selected-Lodge sharing, server-verified ownership, and existing RLS boundaries.
- Keep external data opt-in, read-only by default, attributed, timestamped, freshness-aware, and revocable.
- Treat third-party scores, logs, simulations, player-authored notes, and external content as context—not requirements or trusted instructions.
