# Milestone 7 audit checks

Run the credential-free checks from the repository root:

```sh
node tests/milestone-7/check-guild-foundation.cjs
node tests/milestone-7/check-guild-verification.cjs
```

`guild-operations-assertions.sql` is a synthetic current-schema SQL fixture. Run it only inside one explicit transaction after the matching audit migration is installed or included in that transaction. The caller must issue `ROLLBACK` and confirm that no synthetic users or Guilds remain. Follow `tests/milestone-2/README.md` for database rehearsal boundaries. These checks do not replace real rank-zero and multi-account acceptance.
