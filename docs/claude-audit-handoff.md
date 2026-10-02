# Sequential Claude Code milestone audits

Audit implemented Milestones 0–9 **one at a time**, in numerical order. Open Claude Code in the Lanternmere repository and paste only the starter prompt for the current milestone below. Use a fresh Claude session for each milestone so earlier source dumps do not consume the next audit's context. Stop after each report, bring its findings back for triage, and then continue to the next milestone. Milestone 10 remains planned until the ten reports have been reviewed.

The checkmarks on milestone chats and the `implemented` states in `docs/project-tracker.json` mean feature scope was recorded as delivered. They do not mean independent audit or all live acceptance passed. As of October 2, 2026, `docs/project-status.md` still lists live acceptance gaps. Recheck Git and that document at audit time.

## Shared audit contract

Each starter prompt directs Claude to read this section. For the selected milestone only:

1. Check the actual branch, commit, and working tree. Read `CLAUDE.md`/`AGENTS.md`, `README.md`, `docs/CODEX_SESSION_RULES.md`, the selected milestone specification, the current top of `docs/project-status.md`, and the relevant milestone and acceptance entries in `docs/project-tracker.json`. Read `docs/architecture.md`, `docs/development.md`, and historical checkpoints only where the selected scope needs them. Treat old status entries as history and current code as evidence. Do not infer a feature from a navigation label.
2. Compare every accepted requirement and guardrail in the selected specification with its implementation, authorization path, migrations or RLS where applicable, and focused regression coverage. Trace cross-milestone dependencies only as far as needed to test this milestone's behavior. Include later changes that could have regressed it.
3. Work read-only: do not edit tracked files, implement fixes, apply migrations, create live accounts or production data, deploy, or change hosted settings. Do not read or print private environment values, tokens, or personal data. Run only focused, non-destructive checks useful for a concrete uncertainty. Follow `tests/milestone-2/README.md` before any database rehearsal; never apply its disposable baseline to the original database. If proposing Next.js code changes, first consult the relevant installed guide under `node_modules/next/dist/docs/`.
4. Report **confirmed findings first**, ordered by severity. For each, give the failure path, exact file and line, affected requirement, and a focused fix. Then provide a requirement-by-requirement verdict (`verified`, `defect`, `coverage gap`, or `not applicable`), checks actually run and results, and live acceptance or external-service limits. Distinguish missing evidence from a code defect. If no defect is found, say so. End with a short handoff for the next action. **Stop after this milestone; do not audit the next one.**

Use one focused Claude run per milestone. Do not request a repository-wide rewrite or a full test suite unless a specific finding requires it. After each report, record its outcome and any confirmed fixes in the project handoff; do not silently change the public tracker based on an unverified audit claim.

## Starter prompts

### Milestone 0 — Foundation

> Audit **Milestone 0 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-00-foundation.md`. Focus on the application shell, configuration and secret separation, migration history, initial schema and RLS boundaries, and whether the documented local lint/build acceptance is reproducible. Check later code only where it could invalidate the foundation. Return the standard report and stop.

### Milestone 1 — The Front Door

> Audit **Milestone 1 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-01-front-door.md`. Trace signup, confirmation callback and redirects, sign-in/out, protected routes, profile creation, Lodge onboarding, invitations, roles, and owner-only access through current code and database permissions. Account-management follow-ups may affect this boundary; inspect them only as relevant. Keep hosted confirmation and multi-account checks separate from local evidence. Return the standard report and stop.

### Milestone 2 — Travelers and Characters

> Audit **Milestone 2 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-02-travelers-and-characters.md`. Trace character import/refresh, server-fetched Blizzard data, verified ownership, Main selection, selected-Lodge sharing, private snapshots, consent, source freshness, privileged writes, grants, and RLS. Use `docs/milestone-2-checkpoint.md` and `tests/milestone-2/README.md` as regression and database-rehearsal guidance. Return the standard report and stop.

### Milestone 3 — The Hearth

> Audit **Milestone 3 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-03-the-hearth.md`. Verify selected-Lodge context, Main character and roster data, upcoming events, recent achievements/Chronicles, freshness, empty and partial-failure states, and access boundaries. Include the current Hearth loader and focused regressions. Return the standard report and stop.

### Milestone 4 — Quest Board

> Audit **Milestone 4 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-04-quest-board.md`. Trace Lodge-scoped event CRUD/cancellation, RSVP and attendance, role checks, participant visibility, party composition, and Hearth links. Verify canonical event and RSVP ownership rather than assuming later Guild views own copies. Return the standard report and stop.

### Milestone 5 — Hall of Legends and Chronicles

> Audit **Milestone 5 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-05-hall-of-legends-and-chronicles.md`. Check achievement provenance and visibility, Chronicle author/edit/delete access, Lodge isolation, private media storage and signed access, search/filter behavior, and Hearth activity integration. Return the standard report and stop.

### Milestone 6 — Adventures

> Audit **Milestone 6 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-06-adventures.md`. Verify recurring plans create canonical Quest Board events only by explicit action; campaigns and event strategy notes remain scoped; Raider.IO refresh, cache, consent and failure states are correct; Raidbots links are player-submitted handoffs; and Warcraft Logs remains deferred. Return the standard report and stop.

### Milestone 7 — Guild Operations

> Audit **Milestone 7 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-07-guild-operations.md`. Trace independent multi-Guild membership, roster and consent, verified rank-0 Guild Master claim and expiry, leadership permissions, settings/ownership safeguards, canonical raid publication, and attendance. Test whether unverified or legacy roles can gain authority. Separate code findings from still-open real rank-0/rank-nonzero and second-account acceptance. Return the standard report and stop.

### Milestone 8 — The Raid Room

> Audit **Milestone 8 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-08-raid-operations.md`. Verify Raid Mode access, roster/bench and encounter operations, canonical Quest Board event and RSVP linkage, attendance, scoped Loot Council visibility and decisions, audit history, server authorization, and RLS. Keep human roster/loot decisions and live positive-path coverage distinct. Return the standard report and stop.

### Milestone 9 — The War Table

> Audit **Milestone 9 only** using the Shared audit contract in `docs/claude-audit-handoff.md` and `docs/milestones/milestone-09-weekly-command-center.md`. Verify player and leadership priorities, Guild-only access, canonical raid links, non-raid Guild plans, availability, reset/DST behavior, private Vault notes and per-Guild sharing, stale/consented external context, and authenticated private `.ics` snapshots. Do not treat public calendar subscription as delivered scope. Separate deployment evidence from authenticated and cross-account acceptance. Return the standard report and stop.

## Audit progress and Milestone 10 gate

| Milestone | Claude audit | Findings triaged | Next action |
| --- | --- | --- | --- |
| 0 | Audited October 2: no high/medium defects; three low findings | Triaged: build requirement documented, SQL hardening applied, local schema config added; hosted schema setting remains unverified | Complete; continue in order |
| 1 | Audited October 2: three medium and four low findings | Triaged: invitation redirects, transfer selection/history, Lodge validation, suspended sign-in cleanup, profile-name validation, and callback feedback repaired; hosted and second-account acceptance remain open | Complete; continue in order |
| 2 | Audited October 2: one medium and three low findings | Consent deletion repaired, old orphan cleared, and SQL rehearsed; public-import ownership label, fetch cooldown, snapshot retention, and canonical-result failure lookup added. Pre-fetch alias failures and true realm-transfer identity remain a documented low-severity limit; hosted checks remain open | Complete; continue in order |
| 3 | Audited October 2: no high/medium defects; two low UX limitations | UTC event cutoff is the documented date convention; Hearth Lodge switching meets its specified flow, while cross-section persistence is future scope. Live multi-Lodge, second-account sharing, and responsive/accessibility acceptance remain open | Complete; continue in order |
| 4 | Audited October 2: two medium and three low findings | Linked migration applied and rehearsed: Guild-linked events cannot be deleted, former creators lose delete access, departing RSVPs are cleared, and content bounds are enforced. UI/actions fixes passed focused checks, lint, and build; live acceptance remains open | Run Milestone 5 prompt |
| 5 | Audited October 2: three medium and four low findings | Repair committed as `8e0bf67` and pushed to `main`. Migration applied after one-file dry run and rollback rehearsal; post-apply rollback checks, focused tests, lint, TypeScript, and build passed. Blizzard ingestion, cascade Storage cleanup, and live acceptance remain open | Run Milestone 6 prompt |
| 6 | Audited October 2: one medium and five low findings | Repair committed as `f96886b` and pushed to `main`. The migration was applied after a one-file dry run; pre- and post-apply rollback checks passed, as did focused tests, lint, TypeScript, build, and the error-level security advisor. Live acceptance remains open | Run Milestone 7 prompt |
| 7 | Pending | Pending | After 6 |
| 8 | Pending | Pending | After 7 |
| 9 | Pending | Pending | After 8 |

After each Claude report, review confirmed findings, repair material defects, and update this table and `docs/project-status.md` with the result and exact checks. Keep unresolved live acceptance in the tracker until it is actually verified. Start the dedicated **Milestone 10 — The Muster** chat only after all ten audits have been triaged and any blocking defects are resolved or explicitly accepted with a documented reason.
