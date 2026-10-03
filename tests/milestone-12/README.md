# Milestone 12 database rehearsal

`expedition-assertions.sql` is a synthetic current-schema fixture body. It is not a migration. Run the Milestone 12 migration and this fixture inside one transaction ending with `ROLLBACK`, or run the fixture against an already installed schema inside its own rollback transaction. Never apply the disposable Milestone 2 baseline to the linked Lanternmere database.

The fixture checks verified Guild membership, role interest with owned Travelers, cross-Guild isolation, explicit Raider.IO score sharing and removal, private versus shared goals, direct-write denial, and Guild-departure cleanup. A successful fixture message is useful only when the wrapper has actually rolled back. Follow with aggregate-only checks that no synthetic rows remain. Real accounts and accessibility still require live acceptance.
