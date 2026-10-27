# Guild and raid-team weekly progress — CR-030

## Original requirement and current scope

Will clarified the original spreadsheet-driven requirement on October 26, 2026: a raid leader or officer sets a weekly requirement, such as eight Mythic+ runs, and compares each raider's actual progress, remaining work, raid kills and Great Vault slots on the website. The four owner-supplied October 26 screenshots establish the desired tracking detail and equipment drill-down. A personal addon or a manual goal without completion data does not satisfy that leadership workflow.

The original weekly roster spreadsheet was not recovered from the accessible attachments, repository, Downloads or relevant document folders. A local gear-list workbook is a different source and was not treated as the weekly roster specification. Screenshot column icons and addon data availability do not establish equivalent web API fields.

The owner authorized implementation, then separately approved **local migration preparation** and subsequently **isolated local database testing**. The latter used PGlite 0.5.12 in the artifact folder with install scripts disabled. Hosted migration application, provider changes and deployment remain unapproved. This is a local implementation checkpoint, not a deployed or fully accepted feature. The current security/key-rotation acceptance work remains open separately.

## Delivered locally

- `/guild-hall/progress` is linked from Guild Hall and the leadership War Table. It uses the existing Guild selector and verified Guild Master, officer and raid-leader roles.
- Leaders choose joined Lanternmere Guild members or a canonical raid operation's existing selected/bench roster. The latter uses the chosen shared Traveler for each planned member; it does not guess from another character or grant access through roster selection. This is an event roster, not a newly invented permanent raid-team system.
- Targets are saved for one Guild/raid roster, US/EU region and reset week, with a required run count, minimum key level and optional weekly raid-kill count. Repeated qualifying dungeon runs count individually. Targets do not silently carry forward to a new week, and a raid-specific target does not fall back to a Guild-wide target.
- Desktop comparison table and phone cards show item level, qualifying reported runs, runs remaining, weekly reported raid kills, separately reported Raid/Dungeon/World Vault slots, timestamps and status. Search, status filters and remaining-run sorting help leaders find work to organize. Counts are per shared character, not unique humans; joined members without a shared/selected character remain unknown.
- The equipment drill-down reuses server-fetched Blizzard gear, enchants and socket descriptions. It also lists timestamped weekly boss observations and optional Mythic+ best-run observations. It does not invent currencies, upgrade tracks, missing-enchant recommendations, full lockout availability or simulation results.
- Members can update a structured report for each of their own WoW Travelers in the selected region, and choose whether to share that week's report and existing Vault notes with this Guild's leadership. Existing choices for other Guilds remain effective and are identified in the form. Turning off sharing for one Guild does not claim to make the record globally private.

## Data and trust boundaries

| Field | Current source | Meaning and limitation |
| --- | --- | --- |
| Character identity, equipped item level, equipped gear | Existing Blizzard character refresh and consented cached snapshot | Snapshot date shown; older than 24 hours is marked for refresh. No new roster-wide upstream fan-out on page loads. |
| Completed qualifying weekly Mythic+ runs | Owner-entered list of completed key levels | Player-reported, not provider-verified. Blank is unknown; `none` explicitly means zero. Runs below the leader's minimum do not count. |
| Optional observed Mythic+ runs | Blizzard `/mythic-keystone-profile` optional best-runs response during an existing owner-triggered refresh | Partial evidence only. The source's live payload has not been exercised in this task. Missing, malformed or failed responses preserve the core profile and leave totals unknown. |
| Weekly raid kills | Owner-entered count; separate last-kill observations from Blizzard raid encounters | Reported count is not a lockout API. Observations include only valid timestamps in the regional week, deduplicated by raid/difficulty/boss. Old cumulative kill counts never become this week's totals. |
| Vault slots | Owner-entered 0–3 counts for each activity row | No total or reward inferred from score, best-run count, missing data or historic thresholds. Reward item levels are not available here. |
| Remaining work | Current-week report compared with the exact selected target | Unknown remains unknown. Reports older than 24 hours retain their dated values but cannot receive a current target-met status. |

US and EU windows reuse `weeklyResetForRegion`, including the Pacific DST change and the existing fixed EU UTC schedule. Database validation mirrors this schedule. KR/TW are explicitly unsupported in this first scope. Future/invalid timestamps and prior-week reports do not count as current progress.

Only a verified leader receives the team comparison. Ordinary members receive Guild-wide targets and their own reporting forms. Existing raid-operation privacy is retained; ordinary members are not given private operation titles/rosters by this patch. Players still need their leaders to communicate a private raid-specific target.

The cookie-based Supabase client and existing RLS are retained. The new table has read-only member/leadership policies and an account-suspension restriction. New save RPCs check authenticated active accounts, current ownership/membership, current regional reset, verified leadership and matching Guild/raid scope. The report-sharing action is atomic with saving the report. No service-role client or privileged secret is introduced into these routes.

Reports are joined through **the selected Guild's** `guild_vault_sharing`, rather than collecting every record visible to a leader of several Guilds. Character data separately requires selected-Guild sharing. Invalid, oversized or failed query results fail closed, not as an empty successful roster. Member/operation queries continue using the existing loaders and their existing limits. New character/report queries cap at 1,001 sentinel rows and fail above 1,000; own-character reports cap at 101 and fail above 100.

## EYD-ARCH-001 selection

| Choice | Decision |
| --- | --- |
| Reuse Guild roles, verification, membership, raid selection, Blizzard snapshots, weekly records and Guild sharing | Adopt. These already supply the correct trust boundaries and canonical roster. |
| Add an external tracker or replace the existing Guild architecture | Defer. WarbandStandings is an in-game detail reference, not a verified web integration. WoWAudit remains deferred under CR-025 until an authorized team, supported fields and provider terms can be reviewed. |
| Add a focused structured weekly model, target table, forms and comparison component | Adapt/build the small missing layer. No application dependency or lockfile change. |

The public Raider.IO API documents rate limits, attribution and no guarantee of complete/timely data: <https://raider.io/api>. It is not used as proof of eight completed weekly runs. Blizzard's developer portal (<https://develop.battle.net/documentation/world-of-warcraft/profile-apis>) was accessible only as an unrendered JavaScript shell in the research tool. The optional best-runs parser is covered with synthetic payloads; live compatibility and full weekly data coverage remain unverified. No claim of complete automatic Vault tracking is made.

## Exact database proposal

Prepared migration: `supabase/migrations/20261026184612_guild_weekly_raider_progress.sql`.

1. Add nullable structured run levels, raid kills, three Vault-slot counts and a separate report timestamp to `weekly_vault_progress`. Preserve its text notes and existing per-week consent. New numeric fields and recording time are writable only through the validated RPC; notes-only insert/update paths retain their needed column grants.
2. Add `guild_weekly_requirements`, unique by Guild, roster scope, region and reset date. Only validated leader RPC writes are granted. Guild-wide targets can be read by members; private raid-specific targets remain leadership-only.
3. Add one private reset helper and two validated save RPCs. Existing sharing functions and character ownership are reused. Saves generate the existing sharing audit events or a target-change audit event.

No migration was applied to hosted Supabase. No provider setting, production code, credential or billing change is included. New target rows currently have no automatic pruning job; adding retention must be reviewed before treating long-term target history as a supported feature. Existing weekly-record retention behavior is unchanged.

## Verification and approval gates

Local verification results are recorded in the current project-status entry. `tests/weekly-progress` provides calculation, action/access, provider-failure and rendered-UI runners, plus a synthetic local browser fixture. All use fictional data. `permissions-rehearsal.sql` runs synthetic role/consent assertions inside a transaction ending in rollback. Never use the historical Milestone 2 baseline or the new rehearsal as an excuse to initialize the original database.

The `rehearse.mjs` runner accepts only a local PGlite module path and creates a minimal in-memory dependency fixture. It loads the real existing authorization/consent functions and exact pending migration. Passing it is **not** full current-schema Supabase/PostgREST, concurrent-session or hosted acceptance. The approved temporary test tool belongs only in the task artifact folder; application dependencies remain unchanged.

**Executed October 26:** the exact migration and expanded synthetic role rehearsal passed on in-memory PostgreSQL 18.6. Tests covered Guild/raid target separation, upsert behavior, foreign operations, private raid-target visibility, anonymous/member/owner/Guild boundaries, expired and stale delegated authority, suspension, malformed values and atomicity, zero versus unknown, reset boundaries, legacy notes, per-Guild sharing/revocation and membership departure. All fixture rows rolled back and the engine closed. The runner uses a minimal dependency fixture with real authorization/consent functions and original Lodge/event/operation table DDL; it does not reproduce all current Supabase policies, triggers, PostgREST relationships, platform settings or concurrency. No production migration fix was required. PGlite is an isolated Apache-2.0 test tool, not an application dependency; its installed license is retained. Published metadata declared no runtime dependencies, and the maintainer advisory page listed no published advisories when checked; this does not establish absence of vulnerabilities. See <https://pglite.dev/docs/> and <https://github.com/electric-sql/pglite/security/advisories>.

Before release, require:

1. Exact pending SQL compiles and the disposable role rehearsal passes. An unauthenticated user, ordinary member, expired leader, leader of another Guild and suspended account cannot make forbidden writes. Owners cannot edit another player's report. Numeric ranges, reset boundaries and old notes remain valid.
2. On an explicitly approved isolated current-schema Supabase environment, confirm the PostgREST relationship projection, intended grants, account suspension and existing note/share workflows. Confirm sharing off hides progress, sharing on exposes only the selected Guild's report, and revocation/departure removes access. Refresh must not restore it.
3. Two Guilds with a shared member: a report shared only with A remains absent from B's comparison, even for a leader of both Guilds. Updating a weekly record shared with multiple Guilds shows the existing-sharing notice and affects only the intended per-Guild sharing flag.
4. Set eight runs at +10; a report `10,10,10,10,10,10,9,8` shows six qualifying runs and two remaining. Eight +10 runs show zero remaining and a reported target-met label. Blank does not become zero. A stale report is not counted as currently complete.
5. Select a raid roster with one selected member, one bench member and an unselected member: only planned members appear; each uses its explicitly selected shared character. Removing character sharing yields unknown, not another alt's data. Empty raid roster stays empty.
6. Cross US/EU resets and a US DST boundary: old-week data is not carried forward. No goal is inherited silently. Wrong region, repeated query parameters or foreign Guild/operation links do not reveal records.
7. Desktop and physical iPhone: search/filter/sort, open gear, edit own progress, save target, refresh and revisit. No horizontal page overflow, session loss, 1102 or 5xx. Local synthetic layout checks are not a substitute for this hosted test.
8. Validate an authorized real Blizzard character refresh against the optional endpoint. A 404, throttled/partial response or timeout must preserve the valid base profile. Compare observed activity with the owner's in-game view; never advertise full automatic completion from a partial list.

Only then request the exact hosted migration and application-release approval, recording a fresh production Worker/version and current source commit. Publication may trigger Cloudflare previews/builds; it is not included in the local-only migration approval. Do not recreate a preview against production secrets or use production data for synthetic tests.

## Rollback

- Before release, keep all existing local changes and use the focused branch to review or revert only this feature's files. Generated `.next` output is disposable; source and earlier security notes are preserved.
- After an approved release, revert the application feature to the reviewed pre-feature source while preserving the current secure runtime bindings. The migration is additive and the prior notes workflow remains compatible; leaving unused new columns/table preserves reports for recovery.
- Do not drop new report fields or target rows by default. A destructive SQL reversal would lose new data and needs its own reviewed backup and approval. Do not restore an older vulnerable dependency release or a potentially exposed credential binding as a shortcut.
