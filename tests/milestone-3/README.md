# Character-data enhancement checks

Run `node tests/milestone-3/check-character-enhancements.cjs` and the preserved `node tests/milestone-2/check-profile-errors.cjs` from the repository root.

The enhancement runner uses actual TypeScript modules with mocked I/O. It checks item levels, optional media failures, portrait URL restrictions, backward-compatible snapshots, 24-hour freshness, failure/success ordering, server-resolved ownership, invalid input, failed status persistence, and Hearth revalidation. It does not prove live database policies or browser behavior.

## Database and manual verification still required

1. Identify the intended database and inspect applied migration history. Rehearse the new migration on a disposable database containing migrations through `20260915022529`; never apply the Milestone 2 disposable baseline to the original database. Verify that authenticated users cannot insert/update/delete failures, owners and explicitly shared Lodge members can read them, outsiders cannot, and unsharing removes visibility.
2. Once the migration is verified and applied to the intended project, re-import a saved character. Confirm item levels and a portrait when available, fresh import status, and unchanged Main/sharing selections. Confirm portrait fallback for missing media and old snapshots.
3. Verify a failed refresh retains the saved snapshot and displays failure status; a later successful refresh clears that indicator. Check responsive rendering and keyboard navigation. Use mocked failures or disposable fixtures rather than disrupting the live Blizzard configuration.

Successful attempts use existing snapshot timestamps. Failure rows store attempt start times so an older request finishing late does not override a more recent successful snapshot. This is not an exhaustive concurrent database test.

Blizzard documents the media asset format in its [API change announcement](https://us.forums.blizzard.com/en/blizzard/t/api-changes-wow-shadowlands-pre-patch/11826). Optional fields are validated and missing media never blocks a successful core profile import.

## Executed database rehearsal

On September 16, 2026, `refresh-security-rehearsal.sql` passed on the existing `lanternmere-security-test` project and rolled back. It embeds the unchanged Milestone 2 security migration and regression body, the refresh-failure migration, and `refresh-security-body.sql`. It requires the disposable pre-security-migration schema documented by Milestone 2. Run the entire file only on that disposable project; never use it on Lanternmere. Rebuild/review the embedded copies if source migrations/tests change.

Command used:

```powershell
npx supabase db query --linked --project-ref itilooaltirhkliwtkkd --file tests/milestone-3/refresh-security-rehearsal.sql
```

The project reference explicitly selects the disposable database; it does not relink the repository. The connector query tool is read-only and could not run this rehearsal. Independent read checks verified rollback and absence of fixture users. The tested migration was subsequently applied to Lanternmere after a dry run listed exactly that migration. Browser checks in the preceding section remain pending.

## Hearth context checks

Run `node tests/milestone-3/check-hearth-context.cjs` for 11 mocked checks covering authentication, membership scoping, onboarding, malformed data, safe profile fallback, default/explicit Lodge selection, rejection of foreign/repeated selections, and single-Lodge behavior. Browser checks verified the real greeting/context, phone layout, and invalid-selection 404. No live memberships were added to test switching.

## Main character checks

Run `node tests/milestone-3/check-main-character.cjs` for 9 mocked checks covering owner/Main/WoW filters, empty data, query/network errors, malformed character data, missing snapshots, isolated snapshot failures, and unavailable refresh status. These complement the live populated-state/mobile check; they do not substitute for exhaustive end-to-end failure testing.

## Roster checks

Run `node tests/milestone-3/check-roster.cjs` for 8 mocked checks covering exact membership count, bounded preview, current-Lodge sharing filters, Main/WoW restrictions, missing profile, no shared Main, partial failures, and empty roster. Live single-member/mobile rendering was verified; multi-member and failure fixtures remain mocked.

## Activity summary checks

Run `node tests/milestone-3/check-activity.cjs` for 9 mocked loader and server-render checks covering selected-Lodge filters, three-row limits, UTC date boundary and ordering, isolated query/network failures, malformed dates, empty/populated presentation, escaped text, bounded excerpts, membership gating, and authentication propagation. These do not execute database RLS or verify a live browser. Upcoming events include today in UTC; times have no stored timezone. Achievements and Chronicles are ordered by when recorded. Live activity and responsive/accessibility verification remain pending.
