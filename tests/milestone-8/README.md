# Milestone 8 audit checks

`raid-room-assertions.sql` is a synthetic current-schema SQL fixture. Run it only inside one explicit transaction after the matching audit migration is installed or included in that transaction. The caller must issue `ROLLBACK` and confirm that no synthetic accounts or raid operations remain. Follow `tests/milestone-2/README.md` for database rehearsal boundaries. A fixture pass does not establish the populated Raid Room and Loot Council flows with real accounts under A-02.
