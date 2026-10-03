# Milestone 13 database rehearsal

`history-assertions.sql` is a synthetic fixture body for the linked current schema. Run the new migration plus fixture inside one transaction ending in `ROLLBACK`, or run only the fixture against the installed schema inside its own rollback transaction. Never apply the disposable Milestone 2 baseline to the linked database.

The fixture checks refresh capture, failed-refresh behavior, owner-only reads, denied direct writes, and character deletion cleanup. Follow with aggregate-only checks that no synthetic rows remain. This does not test a real Warcraft Logs OAuth client, real Guild accounts, or the hosted UI.

Run `node --experimental-strip-types tests/milestone-13/public-report-input.test.mjs` to check accepted public report links and rejected lookalike/private URLs.
