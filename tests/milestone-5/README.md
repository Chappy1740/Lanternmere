# Milestone 5 audit checks

Run the four local scripts in this directory for achievement and Chronicle loaders and actions. `check-chronicle-media.cjs` covers media loading and signed-URL request shape. They use fixtures, not a live account.

`legends-chronicles-audit-body.sql` is a synthetic database fixture for `20261002194714_harden_legends_and_chronicles_audit.sql`. Run both in one transaction in this order: `BEGIN`, migration, fixture, `ROLLBACK`. Check for SQL errors and the explicit success marker before the rollback. Do not run the fixture by itself or apply it as a migration. Follow `tests/milestone-2/README.md` before any database rehearsal, and never apply its disposable baseline to the original database.

The fixture creates temporary users, Lodges, Travelers, and entries to test credit ownership, cross-Lodge media, search, Blizzard source protection, former-member deletion, and content bounds. All synthetic rows and the migration are rolled back together.
