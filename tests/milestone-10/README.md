# Milestone 10 database rehearsal

`muster-assertions.sql` is a synthetic current-schema fixture. It is **not** a standalone migration or a safe script to run by itself. Run it only inside one transaction with an explicit `ROLLBACK`, after the Milestone 10 migration has been applied in that same transaction or installed separately. Never run it against the original database without the approved rollback wrapper.

The fixture creates synthetic Auth users and Guilds, exercises claim-gated recruitment, applicant reads, private recruiter notes, cross-Guild isolation, Officer/Master final decisions, retention deletion, and applicant deletion with audit anonymization. It raises an exception if a boundary fails. A successful run prints `Milestone 10 synthetic recruitment checks passed; caller must roll back` and must still be followed by a successful `ROLLBACK`.

After any rehearsal, use aggregate-only checks to confirm that the synthetic Guilds and applications did not remain. Live acceptance with separate accounts and the hosted retention job is still required.
