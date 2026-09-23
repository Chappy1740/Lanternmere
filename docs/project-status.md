# Project status and handoff

## Documentation-phase baseline — September 15, 2026

- Repository: `Chappy1740/Lanternmere`.
- Local checkout: `C:\Users\wdani\EydrenProjects\Lanternmere`.
- Inspected branch: `milestone-3-the-hearth`.
- Both that branch and local `main` pointed to `f1069a9` at inspection; the working tree was clean.
- The user reports Milestones 0–2 complete and included in `main`.

These are historical baseline observations. Check Git for current branch and working-tree state in every new session.

## Milestones

| Milestone | Recorded state                                                                                                                           | Evidence                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 0         | Complete per user handoff; early history contains setup, formatting, environment validation, and design tokens.                          | Repository history; no separate acceptance checklist is preserved.                                                    |
| 1         | Front door and Lodge onboarding complete.                                                                                                | Commit `82b4d70`.                                                                                                     |
| 2         | Travelers and Characters complete, with recorded verification and limitations.                                                           | [Checkpoint](milestone-2-checkpoint.md), commit `f1069a9`, and [regression guidance](../tests/milestone-2/README.md). |
| 3         | The Hearth complete: welcome, Lodge context, Main character, roster, and activity summaries.                                             | Hearth checkpoints below; implementation commit `2896833`.                                                            |
| 4         | Quest Board event and RSVP workflows complete, including party composition.                                                              | Quest Board and group-composition checkpoints below.                                                                  |
| 5         | Hall of Legends and Chronicles complete, including private Chronicle media.                                                              | Milestones 0–5 integration review and Milestone 5 checkpoints below.                                                  |
| 6         | Adventures complete: canonical planning, preparation notes, campaigns, and consented external progress context.                          | [Milestone 6 specification](milestones/milestone-06-adventures.md) and final checkpoint below.                        |
| 7         | Complete: Guild foundation, consented readiness, canonical-event operations, attendance, settings, and cache-state handling are applied. | Guild checkpoints below; Loot Council and awards move to Milestone 8.                                                 |

## Guild foundation checkpoint — September 21, 2026

- User-approved model: Guilds are independent, multi-Guild-capable workspaces; neither Guild membership nor a member-facing Guild portal grants Lodge, Traveler, character, RSVP, or external-snapshot access.
- Locally prepared migration `20260922043253_guild_foundation.sql` creates Guild, Guild-member, composable leadership-role, invitation, Guild-audit, and per-character Guild-consent records. It defaults the member portal off; Guild Master and Officer can opt in through an auditable server-checked operation. Guild Master, Officer, Raid Leader, and Loot Council are application capabilities; regular Guild members obtain no leadership access.
- Guild creation is atomic and assigns the creating authenticated user as sole Guild Master. Invitation redemption is atomic, email-bound when an address is supplied, and creates an ordinary member only. Raw invitation tokens are never stored.
- Local Guild Hall route supports creating a Guild, selecting among a user’s Guilds, and creating seven-day email-bound or shareable Guild invitations. A dedicated invitation route safely returns users through sign-in/sign-up and redeems the invitation atomically. It deliberately sits outside the Lodge route group so a Guild does not require Lodge membership. Roster management, ownership transfer, character-consent controls, canonical event publication, raids, attendance, and loot remain subsequent Milestone 7 slices.
- Current-session verification: focused ESLint, TypeScript, static Guild-foundation checks, production build, and diff-whitespace check passed. Migration `20260922043253_guild_foundation.sql` was applied to the linked Lanternmere database after a dry run; remote history confirms it. Guild Hall browser verification now renders the authenticated “Establish a Guild workspace” form. No Guild has been created and no other live data changed.
- No commit has been created. The unrelated untracked `Prompting_Learning_Workbook.xlsx` remains untouched.

## Character-data enhancement checkpoint — September 16, 2026

- Requirements for Milestone 3 were supplied and approved in the task. The Hearth dashboard itself remains a placeholder.
- The user also approved item levels, character portraits, persisted refresh failures, and a 24-hour refresh suggestion as a bounded prerequisite.
- Implemented locally: optional equipped/average item levels and validated Blizzard avatar retrieval in the existing server import; reusable portrait/freshness presentation in Travelers; separate failure recording for the verified user's existing character. Successful snapshots, Main selection, and sharing are preserved.
- Migration `20260915211428_character_refresh_failures.sql` is prepared, **not applied**. It enables RLS, mirrors existing character read visibility, and permits failure inserts only through the trusted server. Missing status storage degrades to an explicit unavailable message without hiding the saved profile.
- Current-session checks: lint, `tsc --noEmit`, production build, 13 preserved Milestone 2 mocked checks, and 20 new enhancement checks passed. Build initially failed to fetch Google Fonts in the sandbox and passed with network access. Diff whitespace check passed.
- Not verified this session: live Blizzard responses, database migration/RLS execution, authenticated browser behavior, and responsive visual review. The connected Supabase account did not identify the Lanternmere project during inspection. No credentials were read, no live migration was applied, and no commit was made.
- Existing characters acquire item levels/portraits on their next successful import. Media failures use a portrait fallback and do not fail the profile import. Relative age means time since import, not proof of Blizzard data currency; historical refresh failures cannot be reconstructed.
- Next checkpoint: review this enhancement, verify the migration on an identified disposable database and then the intended project, and validate the Travelers UI. Continue to Hearth context/welcome after review under `CODEX_SESSION_RULES.md`.

Regression command: `node tests/milestone-3/check-character-enhancements.cjs` (mocked I/O, no credentials).

## Historical documentation work sequence

1. Create and review this permanent documentation set; preserve existing agent instructions.
2. Review the documentation-only Git diff with the user and commit it.
3. Obtain The Hearth's requirements and acceptance criteria before beginning product implementation.

Do not treat this documentation commit as Milestone 3 implementation or completion. No product code, dependencies, migrations, or live data belong in the documentation phase.

## Information needed for The Hearth

- Dashboard sections and what each should display or allow the user to do.
- Which Lodge's data to show, including behavior for multiple memberships.
- Required data sources, visibility rules, and loading, empty, and error states.
- Acceptance criteria and any visual reference the user wants followed.

## Maintaining the handoff

After a milestone, record the delivered scope, verification actually performed, known limitations, and next agreed step. Link detailed checkpoint evidence rather than rewriting historical results as fresh verification.

## Database verification checkpoint — September 16, 2026

- Identified the linked original project as `aiutndzjfrghffcgwkvn` (Lanternmere) and the existing disposable project as `itilooaltirhkliwtkkd` (lanternmere-security-test). CLI project discovery included both; the connector project list omitted them, although direct read queries worked.
- Ran the preserved Milestone 2 database regression body plus new refresh-failure access assertions in one rollback transaction on the disposable project. Result: `REFRESH SECURITY REHEARSAL PASSED AND ROLLED BACK`. Independent checks confirmed the failure table and temporary trusted-save function were absent, the original save function was restored, and zero fixture users remained.
- The live dry run listed only `20260915211428_character_refresh_failures.sql`. Applied that migration to Lanternmere with vault updates skipped; verified migration history, enabled RLS, authenticated read access through `private.can_read_character`, denied anonymous reads/ordinary-client writes, and permitted trusted-server inserts.
- Security advisors reported no finding for the new table. Existing objects/settings were flagged: intentionally policy-free `game_account_tokens`, three authenticated SECURITY DEFINER RPCs, and disabled leaked-password protection. These were not changed. See [RPC advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [policy-free table guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The earlier “not applied” statement describes the previous checkpoint; the migration is now applied. Browser/live Blizzard validation is still pending. No product code changed in this database verification step; no commit or push was made.
- Next step: authenticated Travelers verification of item levels, portrait/fallback, and refresh status before continuing Hearth layout work.

## Browser verification checkpoint — September 16, 2026

- Verified the authenticated Travelers flow against the running local app and live Blizzard integration. Re-imported existing Wrenx (US/Stormrage); returned to the same character URL with equipped item level 319, average item level 320, a visibly loaded portrait, and a new successful-import timestamp. Main status and the previously selected Lodge-sharing checkbox remained unchanged.
- Verified existing snapshots without media/item levels display fallback content; older snapshots show the 24-hour refresh suggestion. After the verification pause, reloading Travelers correctly recalculated Wrenx's relative import age.
- Visually checked character detail at desktop and 390px phone width, and Travelers cards at 390px and 768px. Tablet content width matched the viewport without horizontal overflow. Verified the keyboard skip link reaches main content and the Add Character link receives visible focus. Restored the browser viewport after testing.
- Failed-refresh and recovery paths remain covered by mocked application checks and disposable database tests, not an intentionally induced live Blizzard/browser failure. Full mobile-navigation accessibility and exhaustive responsive testing remain outside this checkpoint.
- The automatic browser approval review initially stopped inspection because of an account usage limit; verification resumed after the user requested continuation. No product code changed, and no commit/push was made. The local dev server remains running for review.
- Next implementation checkpoint: Hearth personalized welcome and explicit Lodge context, using the agreed requirements and existing membership permissions.

## Hearth welcome and Lodge context checkpoint — September 16, 2026

- Replaced the Hearth placeholder with a real profile greeting, Lodge name/description, membership role, and Travelers link. Blank/unavailable profile names use “Welcome back.” without preventing Lodge rendering.
- Added server-render-scoped cached viewer/membership loading shared by the authenticated layout, Lodge gate, and Hearth. Queries use the ordinary cookie-based client and verified user ID. No schema or privilege changes.
- The default is the earliest joined membership (stable membership-ID tie-break). Multiple memberships expose explicit `/hearth?lodge=<id>` links; absent selection uses that default. Unknown, malformed, or repeated Lodge selections return 404. This is page-local context, not a new global active-Lodge setting.
- Current checks passed: lint, TypeScript, production build, 11 mocked Hearth context checks, and diff whitespace validation. Authenticated browser verification showed the actual profile greeting and Lodge context; a 390px viewport had no horizontal overflow, and an invalid Lodge query returned 404. Multiple-Lodge switching, missing profile, and authentication/membership failures were covered by mocks rather than altered live accounts.
- Remaining Hearth scope: Main character highlight, roster, event/achievement/Chronicle summaries, section failures, and broader accessibility/regression verification. Next checkpoint: Main character highlight and its no-character/error states.
- Changes remain uncommitted; no push performed.

## Hearth Main character checkpoint — September 16, 2026

- Added a Server Component highlight for the verified user's Main WoW character, independent of selected-Lodge sharing. Reuses the existing portrait and freshness components, validated snapshot fields, and ordinary Supabase client. Displays supported values only, with Travelers/detail links for selection and refresh.
- Added separate no-Main and safe query-error states. Snapshot or refresh-status failures preserve basic character content. Authentication remains outside the section's error handling. Main selection now revalidates `/hearth`.
- Current checks passed: lint, `tsc --noEmit`, production build, 9 new mocked Main-loader checks, 11 Hearth-context checks, 20 character-enhancement checks, 13 Milestone 2 profile checks, and `git diff --check`. Browser showed Wrenx's current saved Main data, portrait, race, equipped item level 321, and import age; 390px layout had no horizontal overflow. No-Main/error conditions were mocked, not induced on the live account. No live Main or sharing settings were changed.
- Next checkpoint: Lodge roster summary restricted to the currently displayed Lodge and its character-sharing selections. Changes remain uncommitted.

## Hearth roster checkpoint — September 16, 2026

- Added “Around the Hearth”: exact member count, deterministic preview of up to six members, profile display names, roles, current-user label, and single-member/empty/error messaging. No online presence is inferred.
- Shared Main WoW links are restricted by an explicit `character_lodges.lodge_id` inner join to the displayed Lodge and current roster profile IDs, in addition to existing RLS. Character/snapshot reads use the ordinary client; no schema, privilege, or live sharing changes were made. Shared-character query failures preserve member content. Sharing changes now revalidate the Hearth.
- Current-session checks: lint, TypeScript, production build, 8 mocked roster checks, 11 Hearth-context checks, and diff whitespace checks passed. Browser verified the real single-member roster, role, self label, shared Main link and import age; phone layout checked at 390px. Multi-member and failure cases were mocked; no extra live memberships were created.
- Added `node tests/milestone-3/check-roster.cjs` for membership scoping/count, preview limit, explicit Lodge-sharing/Main/WoW filters, absent profile, no shared Main, partial failure, and empty roster checks. These query-construction mocks complement existing database RLS rehearsals; they do not constitute a new multi-account browser privacy test.
- Next checkpoint: read-only upcoming events, recent achievements, and Chronicle summaries with per-section empty/error states. No commit or push performed.

## Hearth activity recovery checkpoint — September 17, 2026

- Resumed on `milestone-3-the-hearth` with the earlier product work uncommitted. The previous session had added the activity loader, component, page integration, and context-test stub, but had not added activity tests or recorded verification. Welcome, Main highlight, and roster were already checkpointed; they were not rebuilt.
- Merged remote documentation commits `a6b4095` and `651640b` in documentation-only merge `9ad0e3a`. Resolved guidance conflicts by adopting the remote session rules while preserving local project/security guidance. Existing product changes remained uncommitted; nothing was pushed.
- Reviewed the existing read-only activity summaries: each queries only the selected Lodge through the ordinary client, limits results to three, and has independent empty/error states. Events include today onward in UTC with recorded times; achievements and Chronicles show most recently recorded entries. Existing schema and membership read policies were inspected; no database changes were needed.
- Added 9 mocked loader/server-render checks and fixed the Chronicle empty-state apostrophe reported by ESLint. Current-session validation: activity checks (9), Hearth context checks (11), TypeScript, targeted ESLint, and diff whitespace checks passed.
- Live activity queries/RLS execution, authenticated browser rendering, and responsive/accessibility review were not run this session. Supabase documentation fetching was unavailable; review used the checked-in schema and existing query conventions. No production build was run for this test/documentation and JSX-escaping step.
- Next unfinished checkpoint: authenticated activity-summary browser verification and broader Hearth accessibility/regression review. Product work remains uncommitted.

## Hearth regression checkpoint — September 17, 2026

- Committed the completed Hearth dashboard and character-data enhancement work as `2896833` (`feat: build Hearth dashboard`). The branch is five commits ahead of `origin/milestone-3-the-hearth`.
- Current-session regression checks passed: 13 preserved Milestone 2 profile checks; 20 character-enhancement checks; 11 Hearth-context checks; 9 Main-character checks; 8 roster checks; 9 activity-summary checks; full lint; TypeScript through the production build; and diff whitespace validation.
- Browser verification could not run. The previous local dev server had stopped; after restarting it, the in-app browser had no authenticated session and its automation backend timed out while attaching to local tabs. The server received unauthenticated `/hearth` and `/sign-in` requests but logged Supabase authentication fetch failures, so no populated Hearth state was observed. No authentication attempt, account change, or live data change was made.
- The next concrete step is to restore a working authenticated browser/Supabase connection, then verify populated and empty activity summaries at desktop and 390px, keyboard navigation through all Hearth sections, and horizontal overflow. No product changes remain uncommitted.

## Hearth browser and connectivity checkpoint — September 17, 2026

- Fixed local Supabase connectivity by restarting the development server with network access. A local `/sign-in` request returned 200 and the session middleware completed in 146ms; the prior `AuthRetryableFetchError` messages did not recur. No environment files or credential values were read or changed.
- Recreated the local in-app browser tab after the server restart. It loaded the authenticated Hearth for the existing account: profile greeting, Lodge context, Main character, roster, and all three empty activity summaries rendered from live data. The prior Chrome/Edge browser providers are unavailable in this environment; the repaired in-app browser was used instead.
- Phone-width validation at a 390px viewport measured equal document client and scroll widths (375px). The viewport was reset after testing.
- Fixed the shell skip link so its fragment target receives focus by adding `tabIndex={-1}` to `main#main-content`. Browser verification confirmed the skip link focuses the main landmark, and Tab then reaches the Travelers link. No events, achievements, Chronicles, memberships, characters, or other live data were changed.
- Current-session checks passed: targeted ESLint, TypeScript, diff whitespace validation, and the authenticated browser checks above. Next step: populated activity-summary browser coverage if representative live Lodge data becomes available; empty-state, desktop/phone layout, and keyboard entry are verified.

## Hearth populated-activity checkpoint — September 17, 2026

- Rechecked the authenticated live Hearth with repaired Supabase connectivity. The current Lodge has no upcoming events, recorded achievements, or Chronicle entries; all three activity sections correctly rendered their empty states.
- The repository has no authoring route or server action for events, achievements, or Chronicles. No test records were inserted into the shared database, and no live Lodge data was changed.
- Populated activity-summary browser verification remains pending representative live data or explicit authorization to create and later remove scoped test records. Existing mocked activity checks cover populated rows, nullable-field fallbacks, ordering, output escaping, and isolated failures.

## Hearth populated-activity browser checkpoint — September 17, 2026

- With explicit authorization, inserted one uniquely marked event, achievement, and Chronicle for the current verified Lodge/profile pair through the linked Lanternmere project. The insert guard required exactly one matching Lodge membership; the database confirmed one row in each table.
- Authenticated browser verification confirmed populated event title/date/time/type/difficulty, achievement title/description/achievement date, and Chronicle title/body/date. At a 390px viewport, all three summary titles remained present and document client/scroll width both measured 375px.
- Deleted only those three uniquely marked records using the same Lodge/profile guard; the database confirmed one deletion from each table. Reloading the browser restored all three empty states. No persistent test data remains.
- This closes populated and empty activity-summary browser coverage. The Hearth now has recorded desktop/phone, keyboard-entry, populated/empty, mocked failure, lint, TypeScript, and production-build evidence. Broader multi-member/multi-Lodge browser privacy coverage remains represented by mocks and prior query/RLS checks rather than altered live accounts.

## Milestone 3 completion checkpoint — September 17, 2026

- The approved Hearth scope is complete on `milestone-3-the-hearth`: personalized welcome, verified page-local Lodge context, Main character highlight, Lodge-scoped roster, and read-only events, achievements, and Chronicle summaries with empty/error states.
- Current final regression run passed all 70 preserved and Milestone 3 mocked checks: 13 profile, 20 character-enhancement, 11 Hearth-context, 9 Main-character, 8 roster, and 9 activity checks. Full lint and production build passed in the preceding checkpoint.
- The former 30-file formatting baseline was corrected in maintenance commit `a7a9fc3`; `npm run format:check` now passes.
- The working tree is clean. The local branch contains the implementation, verification handoffs, and skip-link fix; it has not been pushed in this session.

## Milestone 4 Quest Board checkpoint — September 17, 2026

- Started `codex/milestone-4-quest-board` from `main` at `dabd84d` after inspecting the existing event and attendee schema, RLS policies, helper functions, and Hearth activity summary.
- Added the Lodge-scoped Quest Board with upcoming and recent-past lists, event detail and participant views, create/edit/delete controls, and self-RSVP for confirmed, tentative, or declined attendance. Existing permissions are preserved: all verified Lodge members can create, while the event creator or an owner/caretaker can edit or remove it.
- Added and applied `20260917165942_harden_event_boundaries.sql`, which prevents changing an event's Lodge or creator and rechecks the event, profile, and optional character ownership on RSVP inserts and updates. Migration history, deployed policy definitions, and its trigger were verified on Lanternmere.
- Hearth upcoming-event titles and a Quest Board link now retain the selected Lodge context. The Quest Board uses its own verified Lodge selection and returns 404 for absent, repeated, malformed, or foreign selections.
- Current-session checks passed: all 75 mocked regression checks (including the 9 activity checks), lint, TypeScript, production build, and diff whitespace validation. `npm run format:check` still reports pre-existing formatting differences across unrelated files.
- Authenticated browser checks verified empty and populated Quest Board states; authorized event creation, edit, confirmed RSVP, participant rendering, and deletion; and the corresponding populated and restored-empty Hearth summaries. The event, RSVP, uniquely labelled temporary Lodge, and confirmed temporary account were removed through the Supabase dashboard. A read-only database check confirmed zero matching Lodges, memberships, events, and users.

## Pre-Milestone-5 consolidation — September 18, 2026

- Consolidated the approved visual direction into docs/design/README.md; permanent production raster assets are under public/brand/, while visual-reference boards remain under docs/design/references/.
- Archived the recovered original Claude MVP requirements at docs/archive/claude-migration/original-mvp-roadmap.md and preserved the Lodge/RLS decision record at docs/adr/ADR-001-rls-policy-boundaries.md.
- Milestones 0–4 remain implemented; no application, database, migration, RLS, or authentication behavior changed in this pass.
- Before declaring the original MVP complete, address or deliberately defer: secure Lodge invites and role-management flows; Quest Board participant role selection and group-composition summary; and Milestone 5 memory media/captions plus search/filtering.
- Next planned checkpoint: UI/design alignment against the approved reference set, then Milestone 5.

## Milestone 5 Chronicles foundation — September 18, 2026

- Added the first production slice of Chronicles: Lodge-scoped chronological listings, detail views, text search, and member-authored create, edit, and delete flows. Entries are read only through the existing `chronicle_entries` RLS policies; server actions also verify the signed-in user and Lodge membership, and restrict edit/delete to the author or a verified owner/caretaker.
- This uses the existing Chronicle table only. No schema migration, Storage bucket, media upload, or live database change was made. The form clearly states that media uploads will arrive in a later Chronicle pass.
- Added five mocked Chronicle checks covering Lodge scoping, bounded listing, detail scoping, in-memory filtering after the scoped read, malformed data, UTC date display, and excerpt cleanup. Current validation passed: Chronicle checks, lint, TypeScript, targeted Prettier, production build, and diff whitespace validation.
- Browser review confirmed the authenticated empty Chronicle state and the new route hierarchy. Creating a live test Chronicle remains intentionally deferred until explicit authorization to add and remove a temporary Lodge memory.
- Added the Hall of Legends authoring slice: Lodge-scoped listing, detail, search, and manual create/edit/delete flows. A record may credit one of the author’s Travelers or be kept as a Lodge-wide milestone. Existing Blizzard-sourced rows remain visibly distinguished from manually recorded rows.
- Added four Hall of Legends mocked checks for Lodge scoping, bounded listing, detail scoping, post-scope search, malformed data, dates, and Lodge-milestone credit. Browser review confirmed the existing temporary verification record renders correctly in the list and detail page; it was not changed or removed.
- Remaining Milestone 5 scope: media/screenshots and captions with approved Storage authorization, a richer group-composition record for events/milestones, and populated browser verification of the new authoring flows.

## Milestone 5 Chronicle media foundation — September 18, 2026

- Added a prepared, unapplied migration for the private `chronicle-media` Storage bucket and `chronicle_media` metadata table. Images are limited to JPEG, PNG, or WebP at 5 MB; captions are limited to 500 characters. Object paths include the Lodge and Chronicle IDs, and Storage/database policies restrict reads to Lodge members and writes/deletes to the Chronicle author/uploader or a verified Lodge owner/caretaker.
- Chronicle create/edit now accepts one optional image and caption, writes through the ordinary authenticated Supabase client, and displays private one-hour signed URLs in the detail view. It never uses a public bucket, public URL, local filesystem storage, or service-role key. Failed new-entry media writes remove the newly created Chronicle; failed edit attachments preserve the text update and return a safe error.
- Retrieved the missing applied migration `20260917200241_harden-legends-and-chronicles.sql` from the linked Lanternmere project, then restored the pre-existing tracked migration files that the retrieval tool had rewritten. Applied `20260918185955_add_chronicle_media_storage.sql` to Lanternmere with vault updates skipped. Read-only verification confirmed RLS on `chronicle_media`, a private 5 MB `chronicle-media` bucket limited to JPEG/PNG/WebP, and all six database/Storage policies. The security advisor reported only the pre-existing public SECURITY DEFINER RPC and leaked-password-protection warnings; no new Chronicle-media warning was reported.
- Current-session checks passed: full lint, TypeScript, production build, Chronicle and Hall mocked loader checks, new mocked media/policy checks, `git diff --check`, migration history verification, and the read-only Storage/RLS query. Live uploads and browser rendering have not been verified in this session.
- Authenticated browser review verified the Chronicle route’s Lodge context, empty state, accessible search label, and scoped no-match search state. Populated Chronicle media upload, signed-image rendering, and authorized removal remain pending because they require creating and deleting temporary Lodge content.
- With explicit authorization, browser verification created a temporary Chronicle using the approved Lodge hero image, confirmed the private signed image and caption render on its detail page, then removed the image and Chronicle. The deleted detail URL returned 404 and the Lodge Chronicle list returned to its original empty state. No test media or Chronicle record remains.

## Milestone 5 achievement provenance hardening — September 19, 2026

- Applied `20260919041137_harden_achievement_source_provenance.sql` to Lanternmere. Ordinary authenticated Lodge members can now insert only `manual` accomplishments; the new database trigger prevents an accomplishment’s source from being changed after creation. Trusted server imports remain able to create Blizzard-derived records.
- A dry run preceded application. Read-only database verification confirmed the manual-only insert policy and immutable-source trigger, and migration history is current through this migration. No accomplishment records were created, edited, or removed.

## Milestone 5 Chronicle date filtering — September 19, 2026

- Authenticated browser review confirmed that both date controls retain their selected values in the URL and produce the combined matching/no-results state without changing Lodge data.
- Added optional inclusive `From` and `To` date filters to Chronicle search. They are applied in the existing selected-Lodge database query before text filtering, retain newest-first ordering, and provide a combined no-results state.
- Current-session validation passed: TypeScript, targeted ESLint, six Chronicle mocked checks including date filtering and Lodge scoping, and `git diff --check`. No migration or live data change was required.

## Milestone 5 Hall of Legends browser verification — September 19, 2026

- Authenticated browser review confirmed the Lodge-scoped Hall search and empty states, plus the detail provenance label for a Lanternmere-created accomplishment.
- Removed the temporary `M5 browser verification achievement` after explicit approval. Its detail route now returns 404 and the Hall returned to its empty state.

## Milestone 5 responsive and accessibility review — September 19, 2026

- Authenticated browser review at a 375 px viewport confirmed responsive Hall of Legends and Chronicles layouts, reachable controls, readable empty states, and the mobile navigation.
- The Chronicle skip link moved keyboard focus directly to main content. The temporary viewport override was reset after review.

## Milestones 0–5 integration review — September 19, 2026

- Milestone 5 is complete: Hall of Legends supports Lodge-visible personal accomplishments and shared Lodge milestones, distinguishes manual from Blizzard-derived records, and protects source provenance. Chronicles support Lodge-private authored records, optional private image/caption attachments, text and date filtering, Hearth reuse, and verified responsive/accessibility basics.
- The original-MVP roadmap still has two unimplemented gaps: secure Lodge invitations with role-management UI, and Quest Board participant role selection with a group-composition summary. Existing event attendance can retain a role value but the current RSVP UI/action does not collect it or provide a composition summary.
- No claim is made that the full original MVP is complete until those gaps are implemented or deliberately deferred by product decision. No schema, RLS, or application change was made by this review.

## Lodge invitations and role management — September 19, 2026

- Added a provider-free invitation workflow in the Caretaker's Office. Lodge owners can create a seven-day, single-use share link or optionally bind the link to an email address and open a prefilled draft in their normal mail app. Lanternmere does not access a personal mailbox or send outbound email.
- Applied `20260919050947_lodge_invitations_and_role_safety.sql` to Lanternmere. It stores only SHA-256 token hashes, enables invitation RLS, permits owner-only invitation administration, and redeems tokens atomically into memberships. Email-addressed invitations verify the accepting account's email within the database function; blank-email links intentionally remain shareable bearer links.
- The migration also changes membership management to owner-only. Owners may manage caretaker/member/guest roles, while owner memberships cannot be created, changed, removed, or self-removed through ordinary authenticated writes. Ownership transfer remains intentionally out of scope for this workflow.
- Current-session checks passed: invitation regression checks, full lint, TypeScript, production build, previous Milestone 5 checks, `git diff --check`, migration dry run/application, and read-only database verification of invitation RLS/policies, the redemption function, and owner-only membership policies. Browser review verified the authenticated owner view and public invitation entry page without creating or redeeming a live invitation.
- Supabase's security advisor reports the intentional authenticated `SECURITY DEFINER` redemption RPC alongside existing warnings for the Lodge-creation and character RPCs, plus leaked-password protection. The redemption function requires an authenticated user, hashes the bearer token, enforces expiration/one-time use/email binding, and runs atomically; no new unreviewed advisor finding was introduced.

## Quest Board group composition — September 19, 2026

- Added optional RSVP role selection (Tank, Healer, Damage, Support, or Flexible) and optional selection of the member's own Traveler. The existing attendee table and RLS already support both fields; the server action now validates role values and verifies the selected Traveler belongs to the signed-in member before the RLS-protected RSVP upsert.
- Event detail shows a confirmed-party composition summary, including an explicit unassigned count, and participants display their role and selected Traveler where present. Tentative and declined replies remain visible in the participant list but do not inflate the confirmed-party summary.
- Current checks passed: six Quest Board mocked checks, lint, TypeScript, production build, and diff whitespace validation. With explicit authorization, authenticated browser verification created a clearly marked temporary event, saved a confirmed Tank RSVP linked to Wrenx, and confirmed the saved participant detail and `Tank: 1` composition summary. The temporary event and its cascade-deleted RSVP were removed; its detail URL returned 404 and the Quest Board returned to its original empty state.

## Milestone 6 Adventures foundation — September 19, 2026

- Replaced the Adventures placeholder with a Lodge-scoped planning hub that presents the next six canonical Quest Board events and routes members directly to event creation and party planning. It does not duplicate events, RSVPs, Travelers, or party composition data.
- No database schema, migration, RLS, or live data change was required. The authenticated browser confirmed the empty state and links render correctly; lint, TypeScript, production build, and diff whitespace validation passed.
- Recurring templates, campaign goals, strategy notes, and progress states remain intentionally unimplemented until their product behavior and data model are agreed.

## Password recovery — September 19, 2026

- Added a visible `Forgot password?` link to sign-in, a generic email-reset request page that avoids account enumeration, an auth-code callback, and a session-verified new-password form. The app never reveals whether a submitted email has an account.
- Browser review confirmed the link and recovery screen render correctly. No recovery email was sent and no password was changed during verification.
- Before production use, add the deployed Lanternmere origin’s `/auth/callback` URL to Supabase Auth’s allowed redirect URLs; local links target the current local origin automatically.

## Lanternmere communication style — September 19, 2026

- Added a durable communication voice and visual specification plus ready-to-paste Lanternmere HTML templates for Supabase sign-up confirmation, password recovery, and email-change messages. The templates are versioned in `supabase/templates/auth/`; they do not send email merely by existing in the repository.
- Updated the provider-free Lodge invitation mail draft with the same warm, clear voice, an explicit private-link notice, and the seven-day expiry.
- Lint, TypeScript, production build, and diff whitespace validation passed. Applying the Auth templates is deliberately deferred until a production Site URL and sending configuration exist.

## Milestone 6 direction: Adventures — September 20, 2026

- The user confirmed the product's broader goal: Lanternmere should be a warm guild home where Guild Leaders and Raid Leaders can see their guild and do practical raid-planning work, while preserving the group's story and identity.
- Milestone 6 is documented as **Adventures**. Its planning scope includes recurring event templates, campaign goals, strategy/preparation notes, progress states, and opt-in external progress summaries. Dedicated guild readiness, attendance, assignment, loot, and leadership workflows move to Milestone 7.
- Future external-progress discovery covers opt-in Warcraft Logs raid progression and Raider.IO Mythic+ progress. The intended first approach is read-only, manually refreshed data with explicit connection/consent, Lodge-role visibility, source attribution, freshness, failure, and revocation behavior agreed before implementation.
- A future weekly readiness view may accept player-submitted Raidbots Top Gear or Droptimizer report links, update times, and player-authored upgrade targets. Leaders can see concise roster-level priorities and return to the original report. Lanternmere will not scrape Raidbots, submit simulations, or present personalized simulation output as a universal gear requirement without a supported reviewed integration path.
- No application, database, RLS, API connection, credential, or external-data change was made in this planning handoff. Before implementation, confirm each provider's current supported integration path, terms, rate limits, data ownership, privacy/consent, and attribution requirements.

## Documentation alignment — September 21, 2026

- Updated the README and project overview so their milestone summary matches the recorded current state: Milestones 0–5 are implemented and Milestone 6 is in progress with its Adventures foundation delivered.
- No application, database, RLS, API, authentication, or external-data behavior changed. The next Milestone 6 product slice remains intentionally unselected pending agreement on its behavior and data model.

## Milestone 6 recurring plans — September 21, 2026

- Added Lodge-scoped weekly recurring plans to Adventures. A plan stores reusable event details and can prefill a manually dated Quest Board event; it never creates events automatically or duplicates RSVP, Traveler, or party-composition records.
- Applied `20260921083259_adventure_event_templates.sql` to Lanternmere after a dry run that listed only this migration. The new table has RLS and separate authenticated policies for member reads/inserts, creator-or-admin updates, and creator-or-admin deletes; identity changes are blocked by a trigger.
- Current-session checks: new recurring-plan mocked checks, existing Quest Board mocked checks, lint, TypeScript, production build, `git diff --check`, migration-history verification, a read-only RLS/policy catalog query, and the Supabase security advisor. The advisor reported only the existing public SECURITY DEFINER RPC and leaked-password-protection warnings; no new warning concerns the template table.
- Authenticated browser review confirmed the Adventures empty state and recurring-plan form against the applied schema. No live template was created; populated, prefill, delete, multi-Lodge, and non-author authorization browser paths remain covered by application/RLS design and mocked loader checks rather than altered live Lodge data.
- Next Milestone 6 slice remains to be selected from campaigns/goals, strategy/preparation notes, or leader-focused readiness views. External integrations remain deferred pending provider discovery and explicit agreement.

## Milestone 6 campaigns and goals — September 21, 2026

- Added Lodge-private, manually maintained campaigns with an optional focus, optional numeric goal, progress count, and active/completed/archived state. Campaigns do not infer external progress or create assignments.
- Applied `20260921085040_lodge_campaigns.sql` after a dry run listing only that migration. RLS separates member reads/inserts from author-or-lead updates/deletes and freezes Lodge/author identity.
- Current-session checks: campaign mocked loader/migration checks, lint, TypeScript, production build, `git diff --check`, and authenticated browser review of the empty/form state. No live campaign was created. Next proposed slice: strategy and preparation notes for canonical Quest Board events.

## Milestone 6 Raider.IO manual refresh — September 21, 2026

- Applied `20260921092826_raiderio_readiness.sql` after a dry run. It adds per-character, selected-Lodge consent and a private saved Raider.IO summary. RLS permits an owner to select/enable/revoke their sharing and permits only the owner or members of a selected Lodge to read a saved summary; snapshot writes use the server-only service-role client.
- A Traveler owner can now manually request the documented public Raider.IO character profile endpoint. The server validates the owned Traveler's saved region, realm, and name, never exposes a credential, stores the source URL/timestamp/progression summary, honors HTTP 429 with a safe response, and limits a successful refresh to once every 24 hours. An upstream failure does not overwrite a successful snapshot.
- Owner browser review confirmed the rendered refresh control, UTC timestamp, Raider.IO attribution link, and saved success state on an existing Traveler. It did not create or remove Lodge sharing, events, campaigns, or other temporary data.
- Applied `20260921101922_raiderio_snapshot_identity.sql` after a dry run. It adds a minimal identity projection to the existing consented snapshot and backfills it from saved Travelers; it does not change sharing policies or grant a leader broader Traveler access.
- Adventures now shows Lodge owners/caretakers the opted-in snapshot identity, Mythic+ score, freshness, latest safe failure message, and Raider.IO source link. The loader first scopes character IDs to the selected Lodge's consent rows, then reads only the RLS-permitted snapshots; it does not join or expose the broader `characters` profile.
- Current-session checks: lint, TypeScript, `git diff --check`, migration dry run/application, read-only column verification, migration-history verification, the Supabase security advisor, and authenticated browser review. The advisor reported only existing callable SECURITY DEFINER RPC and leaked-password-protection warnings; none concern this slice. The browser confirmed the leader card renders Wrenx's opted-in snapshot with score, fresh status, and source link. No sharing, event, campaign, or other temporary data was changed during this check.

## Milestone 6 Raidbots report handoff — September 21, 2026

- Applied `20260921102721_character_raidbots_reports.sql` after a dry run. A Traveler owner can save an existing Raidbots URL and optional, 500-character player-authored upgrade target for a selected Lodge. RLS allows the owner to manage it and members of that selected Lodge to read it.
- Lanternmere validates that report URLs use the Raidbots host but never submits simulations, scrapes report data, or makes an external Raidbots request. Adventures leaders see the voluntarily shared character identity, targets, update time, and a link back to the original report.
- Current-session checks: lint, TypeScript, `git diff --check`, migration dry run/application, and authenticated browser review of the empty report-sharing form. No live report link or targets were saved.

## Raider.IO progress banner — September 21, 2026

- Traveler detail pages now render the saved Raider.IO snapshot as a read-only progress banner: Mythic+ score, available raid-tier summaries, UTC refresh timestamp, and source link. It uses the existing snapshot JSON and does not add polling or a schema change.
- Lint, TypeScript, and `git diff --check` passed. Warcraft Logs live progression remains pending a server-side Warcraft Logs OAuth client registration and credentials; no unsupported scrape or placeholder live integration was added.

## Guild Operations long-range roadmap — September 21, 2026

- Locked the post-Milestone-6 Guild Operations roadmap into Milestones 7–14: Guild Hall foundation, Raid Room, Weekly Command Center, Recruitment & Trials, Professions & Guild Services, Mythic+ Operations, Progression Intelligence, and the future Lanternkeeper assistant.
- Added a Supply Chest verified-resources policy so Lanternmere can deliberately link to canonical specialist sites and guides without implying every linked service is integrated or duplicating restricted third-party content.
- This roadmap update is documentation-only. It does not add schema, RLS, application behavior, API credentials, or external calls.

## Lanternkeeper readiness completion gate — September 21, 2026

- Milestone 6 remains in progress; no Milestone 6.5 was created.
- Before closing Milestone 6, perform a targeted Lanternkeeper-readiness audit across Milestones 1–6.
- The audit checks structured data, reusable authorized server services, RLS/permission boundaries, provenance/freshness/consent for external data, stable record relationships, and treatment of retrieved/user-authored content as untrusted data.
- The audit does not require adding AI calls, chat persistence, embeddings, model credentials, or AI-specific schema to completed milestones.
- Findings should be classified as no-change, targeted refactor, or deferred Milestone 7+ work. Only material compatibility/security/provenance issues should be fixed before closing Milestone 6.

## Milestone 6 Adventures completion — September 21, 2026

- Milestone 6 is complete. Delivered scope is the canonical Quest Board-backed Adventures hub, recurring event templates and campaigns, canonical event strategy/preparation notes, consented manually refreshed Raider.IO snapshots, and player-submitted Raidbots report handoffs.
- The Adventures page now accurately states that strategy and preparation live on canonical Quest Board events. Guild operations remain Milestone 7 work. Warcraft Logs live integration is explicitly deferred to Milestone 13 because it requires a supported OAuth/client-credential integration; no scraping, placeholder credentials, or unsupported connection was added.
- Targeted Lanternkeeper readiness audit across Milestones 1–6: **no material architecture refactor required**. Existing structured records and stable IDs, server-only loaders/services, Zod validation, authentication/ownership/Lodge and selected-Lodge sharing/RLS boundaries, external provenance/freshness/consent/failure state, canonical relationships, and untrusted-text treatment provide the required future foundation. No AI APIs, credentials, embeddings, vector storage, chat tables, AI schema, or runtime code was added.
- Current-session verification passed: `npm run lint`; `npx tsc --noEmit`; `npm run build`; `node tests/milestone-6/check-event-templates.cjs`; `node tests/milestone-6/check-campaigns.cjs`; `node tests/milestone-2/check-profile-errors.cjs`; and `git diff --check`. The first sandboxed build compiled but hit Windows `spawn EPERM` during Next TypeScript processing; the authorized retry completed successfully. The mocked Milestone 2 security regression completed 13 checks with no live credentials or network use.
- Read-only `npx supabase migration list` confirmed that every local migration through `20260921102721_character_raidbots_reports` matches remote migration history. No migration or production data was created or changed. No authenticated browser smoke check ran in this session because no local application/browser session was available.
- Read-only `npx supabase db advisors --linked --type security` reported only the existing warnings for four intentionally callable `SECURITY DEFINER` RPCs (`create_lodge`, `redeem_lodge_invitation`, `set_character_lodge_sharing`, and `set_main_character`) and disabled leaked-password protection. It reported no Milestone 6-specific security finding.
- Next planned milestone: Milestone 7 — The Guild Hall: Guild Operations.

## Milestone 7 Guild membership operations — September 22, 2026

- Guild Hall now has a leadership-only Lanternmere member directory. A Guild Master can grant or revoke the existing composable Officer, Raid Leader, and Loot Council roles; Officers can manage Raid Leader and Loot Council roles only. The server action validates its input and the database RPC remains the final authorization and audit boundary.
- Applied `20260922095617_guild_ownership_transfer.sql`. Guild Master ownership is now an explicit, seven-day, recipient-accepted flow: only a current Guild Master may request or cancel it, only the specified current member may accept it, and accepting atomically removes the former master role, grants the recipient the master role, and records audit events. Direct role policies can no longer create another `guild_master` membership.
- Current-session checks: focused Prettier, ESLint, TypeScript, `git diff --check`, remote migration dry run/application, migration-history confirmation, Supabase security advisor, and authenticated browser review. The browser displays the Member Operations and Guild Master Ownership sections; no live invitation, member role, or ownership transfer was created because the Guild currently has one Lanternmere member.
- The security advisor reports the intentional authenticated `SECURITY DEFINER` Guild transfer RPCs alongside the existing callable Guild/Lodge RPCs and disabled leaked-password protection. Each new transfer RPC authenticates the caller, verifies the specific Guild member/role inside the transaction, uses an empty `search_path`, and has `PUBLIC`/`anon` execution revoked.
- Refreshed the existing, consented official Morning Mayhem roster after adding server-side Blizzard class-ID normalization. The saved 919-entry snapshot now renders class names and preserves the imported Guild rank labels; it did not create Lanternmere accounts, memberships, Travelers, or character claims.

## Milestone 7 canonical Guild raid operations — September 23, 2026

- Applied `20260923090723_guild_raid_operations.sql`. A Guild raid operation references a canonical Quest Board event and stores only Guild-owned notes, roster planning, and assignments; it neither duplicates events, RSVPs, nor Travelers.
- Authorization is explicit and atomic: the actor must be both Guild leadership and either the canonical event creator or a Lodge owner/caretaker. The narrow Guild event projection is available through an authorization-checking RPC; Guild membership alone still grants no direct Lodge event or RSVP access.
- Planned roster entries reference existing Guild memberships, distinguish selected from bench, and require a human-selected Tank, Healer, or DPS role. Assignments reference Guild members optionally; all operational mutations are server-validated, stored through checked RPCs, and append Guild audit records.
- Current-session verification passed: focused Prettier, `npx tsc --noEmit`, `npm run lint`, `node tests/milestone-7/check-guild-foundation.cjs`, `git diff --check`, migration dry run/application, migration-history confirmation, and the Supabase security advisor. `npm run build` reached the known environment failure fetching existing Google Fonts (Cinzel and Inter); it did not report an application TypeScript or lint failure. The advisor reports expected authenticated `SECURITY DEFINER` warnings for the intentionally checked RPCs (including the new ones) plus the pre-existing leaked-password-protection warning.
- `http://localhost:3000/guild-hall` returned HTTP 200. The in-app browser automation timed out before it could capture the authenticated Guild Hall, so no browser UI claim is recorded. Multi-account authorization paths and populated UI behavior remain to be tested with a second account.

## Milestone 7 Guild raid attendance — September 23, 2026

- Applied `20260923092223_guild_raid_attendance.sql`. Guild leadership can record invited, confirmed, attended, late, absent, or benched outcomes for existing Guild members on an authorized Guild raid operation, with an optional contextual note.
- Attendance is operational context only and does not read, overwrite, or synchronize Quest Board RSVPs. The mutation verifies Guild leadership and same-Guild membership in a server-checked RPC, preserves RLS read boundaries, and appends a Guild audit record.
- Current-session checks passed: focused Prettier, `npx tsc --noEmit`, `npm run lint`, `node tests/milestone-7/check-guild-foundation.cjs`, `git diff --check`, migration dry run/application, linked migration-history verification, and the Supabase security advisor. The advisor reports the intentional authenticated, checked attendance RPC alongside the existing expected checked RPC warnings and leaked-password-protection warning.
- Browser limitation: the local Guild Hall returned HTTP 200, but the in-app browser CDP bridge timed out while navigating/focusing the visible localhost tab; Chrome is unavailable on this host. No authenticated browser interaction or live attendance record was created.

## Milestone boundary decision — September 23, 2026

- The user moved Loot Council workflow, loot awards, and award history to Milestone 8. Milestone 7 retains Guild foundation, permissions, consented readiness, canonical-event operations, attendance, and Guild settings; its specification and roadmap now reflect that boundary.

## Milestone 7 completion — September 23, 2026

- Guild Hall now renders cache provenance and 24-hour freshness for consented Traveler snapshots and official Blizzard roster data. A permitted failed official-roster refresh records a bounded, auditable failure state while preserving and displaying the last successful roster and its attributed source.
- Applied `20260923100807_guild_roster_refresh_failures.sql` to the linked Lanternmere database after a dry run. The server-checked function permits only Guild Master/Officer callers to update an existing roster snapshot's failure state; it cannot create a snapshot or replace cached successful data. Remote migration history matches local history.
- Current-session verification: Milestone 7 regression checks, ESLint, TypeScript, targeted Prettier formatting, and `git diff --check` passed. The repository-wide formatter remains a pre-existing baseline failure across 154 files, including untouched files. The Supabase security advisor reported the intentional authenticated `SECURITY DEFINER` RPC warnings (including the new bounded refresh-status RPC) and the existing leaked-password-protection warning; no new unreviewed RLS finding was introduced.
- Milestone 7 is complete. Loot Council workflows, awards, award history, and Raid Mode remain reserved for Milestone 8.

- Milestone 7 is complete with independent multi-Guild membership and roles, official roster import, consented Traveler readiness, canonical Quest Board raid operations, selected/bench role planning, Guild assignments and notes, attendance, and Guild settings/ownership safeguards.
- Loot Council workflow, awards, and award history are intentionally deferred to Milestone 8. Remaining validation limits are live multi-account authorization coverage and authenticated browser capture; no unsupported claims of those checks are made.
- Applied `20260923095432_guild_identity_settings.sql`: Guild Masters and Officers now edit Guild identity through an audited, server-checked RPC; direct authenticated table updates are revoked.
