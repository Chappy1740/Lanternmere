# Milestone 11 database rehearsal

`artisan-assertions.sql` is a synthetic current-schema fixture body. It is not a standalone migration. Run it only inside one transaction with an explicit `ROLLBACK`, after the Milestone 11 migration has been applied in that transaction or installed separately. Never run a disposable baseline against the original Lanternmere database.

The fixture checks owned Traveler publication, Guild isolation, denied direct writes, Officer/Master supply-goal control, manual request transitions, and cleanup on Guild departure. A successful message does not replace the required rollback or live tests with separate accounts. After rehearsal, use aggregate-only checks to confirm no synthetic rows remain.
