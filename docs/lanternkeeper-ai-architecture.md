# Lanternkeeper AI Architecture

## Purpose

The Lanternkeeper is Lanternmere's assisted-intelligence layer. It should help players and guild leaders understand authorized Lanternmere data, find the next useful action, and reach trusted external resources without becoming an autonomous guild leader.

Lanternmere does not need to train its own foundation model. The application should place a controlled, provider-abstracted AI service behind Lanternmere's authentication, authorization, domain tools, and audit boundaries.

## Core request flow

1. A signed-in user asks the Lanternkeeper a question or chooses a contextual starter action.
2. Lanternmere authenticates the request on the server.
3. Lanternmere determines the current Lodge/Guild context and application permissions.
4. The AI orchestrator may request only registered Lanternkeeper tools.
5. Each tool independently enforces authorization and returns the minimum necessary structured data.
6. The model produces a response from that authorized context.
7. The response distinguishes Lanternmere facts, external snapshots, player-entered data, stale/missing data, and AI suggestions.
8. Where practical, the answer links back to the authoritative Lanternmere record or verified Supply Chest resource.

The model must never receive unrestricted database credentials or direct arbitrary database access.

## Provider abstraction

Keep model-provider details behind a server-side interface so Lanternmere can change model/provider without rewriting guild-domain code.

The provider layer should support:

- structured tool/function calling;
- structured output where appropriate;
- streaming responses where useful;
- request timeouts and cancellation;
- configurable model selection;
- token/cost accounting;
- provider error normalization;
- safe fallback when AI is unavailable.

API keys and provider credentials are server-only secrets.

## Tool architecture

Lanternkeeper capabilities should be exposed as narrow domain tools rather than a giant prompt or arbitrary SQL.

Potential read tools:

- get_current_user_context
- get_my_characters
- get_guild_summary
- get_upcoming_events
- get_raid_roster
- get_raid_readiness
- get_attendance_history
- get_loot_history
- get_mythic_plus_progress
- get_recruitment_status
- get_crafting_capabilities
- get_verified_resources
- get_raiderio_snapshot
- get_warcraft_logs_summary

Tool names are architectural examples, not an implementation requirement.

Every tool must:

- authenticate the caller;
- enforce application authorization and Supabase/RLS boundaries;
- scope data to the active Lodge/Guild/user context;
- return only fields needed for the task;
- preserve source/provenance and timestamps for external snapshots;
- fail safely without leaking private records.

## Write actions

Read-only intelligence should ship before write actions.

Potential later assisted actions include:

- draft_raid_plan
- draft_announcement
- draft_event
- draft_assignment_plan
- draft_recruitment_message

Important or persistent mutations require explicit human review and confirmation before saving.

The Lanternkeeper must not autonomously:

- award loot;
- remove or bench a raider;
- accept/reject a recruit or trial;
- promote/demote a member;
- discipline a member;
- alter permissions;
- publish announcements;
- delete guild records.

## Contextual experiences

Lanternkeeper should exist as both a dedicated destination and contextual assistance.

Examples:

### Dedicated Lanternkeeper

Starter actions may include:

- Prepare me for tonight's raid.
- What needs my attention this week?
- What changed since our last raid?
- Who still needs Vault progress?
- Find someone who can craft this.
- Help me review tonight's roster.
- Show recent loot history.
- Find a verified resource for this boss.

### Raid context

"Ask Lanternkeeper about this raid" can use the active raid/event ID and authorized raid-operation records.

### Character context

"Summarize this Traveler's week" can use only character data the current user is authorized to see.

### Loot context

"Summarize the candidates" may organize factual candidate information and council inputs without recommending a winner.

### War Table context

"Brief me for this week" can summarize outstanding confirmations, availability, readiness, events, and stale data.

## Supply Chest integration

The Supply Chest verified-resource catalog is Lanternkeeper's trusted external-resource directory.

When a user needs a specialist service, Lanternkeeper should prefer an approved canonical destination from the Supply Chest instead of inventing or guessing a URL.

A verified resource does not imply an API integration.

Resource results should identify:

- provider/resource name;
- purpose;
- canonical destination;
- verification/review metadata when available;
- whether Lanternmere has a live integration, saved handoff, or link-only relationship.

## Data classification in answers

Lanternkeeper responses should distinguish:

- **Lanternmere record** — authoritative application data.
- **External snapshot** — imported/cached provider data with source and timestamp.
- **Player-entered information** — user-authored notes, targets, availability, or preferences.
- **AI suggestion** — generated assistance, not stored fact.
- **Missing/stale data** — explicitly identified rather than silently guessed.

## Security and privacy

- AI calls are server-side only.
- Never send service-role credentials, access tokens, provider secrets, or unnecessary personal data to the model.
- Authorization happens before data enters model context.
- RLS remains defense in depth; AI does not bypass it.
- Prevent cross-guild and cross-Lodge data leakage.
- Minimize context to what is necessary for the current request.
- Define retention behavior for prompts/responses before persistent conversation history is enabled.
- Treat retrieved notes, external content, logs, and user-entered text as untrusted data, not model instructions.
- Tool results cannot grant new permissions or override system/application policy.

## Prompt-injection resistance

External pages, provider text, player notes, recruitment applications, encounter notes, and other retrieved content may contain hostile instructions.

Lanternkeeper should:

- separate instructions from retrieved data;
- never execute instructions embedded in tool results;
- restrict tool calls to an allowlist;
- validate tool parameters server-side;
- require authorization again inside each tool;
- avoid arbitrary URL fetching;
- use the verified Supply Chest catalog for external navigation;
- require confirmation for meaningful writes.

## Audit and observability

Record enough metadata to debug and secure the feature without unnecessarily storing private model context.

Potential audit fields:

- requesting user;
- active Lodge/Guild;
- feature/context surface;
- model/provider identifier;
- tools invoked;
- success/failure;
- latency;
- token/cost counters;
- write confirmation and resulting record IDs where applicable.

Do not log secrets or full sensitive tool payloads by default.

## Cost and usage controls

Plan for:

- per-user and per-guild rate limits;
- maximum tool-call depth;
- request/token budgets;
- context trimming;
- caching of safe deterministic summaries where appropriate;
- smaller/cheaper models for simple classification or formatting tasks;
- higher-capability models only when the task benefits;
- clear failure/fallback UI when a budget or provider limit is reached.

AI availability must never be required to use core Lanternmere features.

## Accuracy and provenance

Lanternkeeper should not manufacture missing guild facts.

For operational answers:

- cite/link to underlying Lanternmere records where practical;
- show external provider/source and freshness when relevant;
- state when required information is missing;
- avoid presenting an AI inference as a stored fact;
- allow the user to open the authoritative screen.

## Accessibility and UI

- Keyboard-accessible chat and starter actions.
- Screen-reader-friendly streaming/status updates.
- Do not rely on color alone for fact/source/stale distinctions.
- Keep responses scannable during raid-night use.
- Provide direct actions/links to authoritative screens rather than long prose when possible.

## Rollout plan

### Phase 1 — Architecture readiness

During Milestones 7–13:

- keep domain data structured and permission-aware;
- expose reusable server-side loaders/services rather than AI-specific database shortcuts;
- preserve provenance/timestamps;
- maintain verified Supply Chest resources;
- keep audit-friendly IDs and relationships.

### Phase 2 — Read-only Lanternkeeper

Initial Milestone 14:

- dedicated Lanternkeeper surface;
- contextual starter actions;
- authorized read-only tools;
- weekly and raid briefings;
- verified-resource discovery;
- links back to authoritative Lanternmere screens;
- cost/rate limits and audit telemetry.

### Phase 3 — Human-confirmed assistance

After read-only behavior is trusted:

- drafting tools;
- proposed plans/assignments;
- explicit review/confirmation;
- carefully scoped writes.

## Definition of success

The Lanternkeeper is successful when it saves players and guild leaders time by turning authorized Lanternmere data into clear next actions while remaining optional, permission-aware, explainable, and human-controlled.
