# Milestone 2 regression tests

Run from the repository root after npm ci:

    node tests/milestone-2/check-profile-errors.cjs

Uses the repository's actual TypeScript profile client and validation with mocked I/O. No credentials or live requests. Covers 13 cases: throttling, unavailable profiles, denied authentication, upstream errors, network/timeout rejection, malformed responses, token failure, validation without I/O, and successful recovery/normalization.

## Database rehearsal

These SQL files target a disposable Supabase database at the PRE-security-migration schema. Never run the baseline in the original Lanternmere project. The original project already has the security migration applied.

1. On an empty disposable Supabase project, run the entire lanternmere-test-baseline.sql to create the five preceding migrations. This commits the baseline and does not create migration-history entries.
2. Run the entire lanternmere-security-editor.sql in the SQL Editor as postgres. It temporarily applies the exact checkpoint migration, runs role-based assertions, rolls back to a savepoint, checks restoration, and rolls back the outer transaction. Expected final result: REHEARSAL PASSED AND ROLLED BACK. Pending migration remains unapplied.
3. Alternatively, use lanternmere-security-rehearsal.sql with a dedicated psql connection and -X -f. Do not use a single-transaction wrapper. It uses psql error-stop commands and is NOT an SQL Editor script.

security-regression-body.sql is included in the standalone scripts for reference; do not run it alone. The embedded migration matches checkpoint a4f392c; regenerate/review scripts if migration definitions change.

The SQL Editor rehearsal passed on September 15, 2026. Additional read-only checks confirmed rollback restored the old function, removed the new function, and removed fixture users. An error is a failure: stop and explicitly ROLLBACK any still-open interactive transaction before continuing. Do not bypass assertions.

The suite tests privileges, trusted saves, Main selection, sharing ownership and visibility, invalid inputs, refresh preservation, and forced snapshot failure atomicity. It does not simulate concurrent database sessions. Browser checks and results are recorded in docs/milestone-2-checkpoint.md.
