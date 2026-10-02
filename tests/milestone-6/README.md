# Milestone 6 audit checks

From the repository root, run the campaign, recurring-plan, Raider.IO, readiness, and action checks in this directory. They use synthetic fixtures and mocked network/database clients. `check-lodge-invitations.cjs` is an existing cross-feature regression.

`adventures-audit-body.sql` tests the current database schema with synthetic users. For a pending migration, execute `BEGIN`, the contents of `20261002221007_harden_adventures_audit.sql`, the fixture body, an explicit success marker, and `ROLLBACK` in one connection. After migration application, omit the migration text and run the same fixture inside a transaction. Do not run the body by itself. Follow `tests/milestone-2/README.md`; never apply its disposable baseline to the original database.

The SQL fixture tests plain-member denial, consented leader and owner reads, column limits, and the service-only 24-hour refresh claim. It rolls back all synthetic users and data.
