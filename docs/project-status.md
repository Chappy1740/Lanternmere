# Project status and handoff

## Documentation-phase baseline — September 15, 2026

- Repository: `Chappy1740/Lanternmere`.
- Local checkout: `C:\Users\wdani\EydrenProjects\Lanternmere`.
- Inspected branch: `milestone-3-the-hearth`.
- Both that branch and local `main` pointed to `f1069a9` at inspection; the working tree was clean.
- The user reports Milestones 0–2 complete and included in `main`.

These are historical baseline observations. Check Git for current branch and working-tree state in every new session.

## Milestones

| Milestone | Recorded state                                                                                                  | Evidence                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 0         | Complete per user handoff; early history contains setup, formatting, environment validation, and design tokens. | Repository history; no separate acceptance checklist is preserved.                                                    |
| 1         | Front door and Lodge onboarding complete.                                                                       | Commit `82b4d70`.                                                                                                     |
| 2         | Travelers and Characters complete, with recorded verification and limitations.                                  | [Checkpoint](milestone-2-checkpoint.md), commit `f1069a9`, and [regression guidance](../tests/milestone-2/README.md). |
| 3         | The Hearth: welcome and Lodge context implemented; remaining sections pending.                                  | See the Hearth welcome and Lodge context checkpoint below.                                                            |

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
