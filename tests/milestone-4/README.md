# Quest Board audit checks

Run `node tests/milestone-4/check-quest-board.cjs` for the existing loader checks and `node tests/milestone-4/check-quest-board-actions.cjs` for mocked permission, zero-row, Guild-link error, and redirect checks.

`quest-board-audit-body.sql` contains synthetic current-schema database assertions. Run it only inside one transaction with `BEGIN` before the body and `ROLLBACK` after it. For a pending migration rehearsal, place the migration between `BEGIN` and the body. It checks Guild-linked deletion protection, authorized unlinked deletion, Lodge-exit RSVP cleanup, former-member direct-API deletion, and content constraints. Never apply the historical Milestone 2 disposable baseline to the linked Lanternmere database. These checks do not replace live second-account or browser acceptance.
