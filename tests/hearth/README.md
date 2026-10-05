# Verified Traveler regression checks

Run `node tests/hearth/add-owned-traveler.test.cjs` and `node tests/hearth/remove-traveler.test.cjs` locally. These mock the server clients; they do not contact providers or read credentials.

## SQL rehearsals

All SQL fixtures are bodies for one caller-owned `BEGIN` / `ROLLBACK` transaction. Never run them without rollback. They create synthetic users with `example.invalid` addresses.

- Before installing the cleanup migration, run `traveler-cleanup-setup.sql`, the prepared migration, then `remove-traveler-assertions.sql` inside the same transaction. The setup deliberately creates an unverified legacy Traveler and must not run against the installed proof constraints. The assertions verify cleanup preserves shared RSVP/achievement records while removing the character and Lodge link.
- After installation, run only `remove-traveler-assertions.sql` inside `BEGIN` / `ROLLBACK`. It checks cross-account and suspended-account denial, direct import/deletion denial, deferred proof integrity, personal-history cascade, claim release/re-addition, and removal of the final Traveler without removing its account.
- `claimed-travelers-assertions.sql` retains earlier account-list proof and exclusive-claim evidence. Historical Milestone 2 fixtures intentionally use public-name imports and should be rehearsed against their disposable historical baseline, not adapted silently to the new policy.

Rollback evidence does not replace real-account or hosted UI acceptance under A-09.
