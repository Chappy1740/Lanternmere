# Milestone 9 audit checks

Run the credential-free check from the repository root:

```sh
node tests/milestone-9/check-war-table.cjs
```

`war-table-rls-rehearsal.sql` contains its own transaction and synthetic current-schema records. Inspect its transaction boundaries before running it on a linked database, and confirm its final `ROLLBACK` and zero remaining synthetic records. Follow `tests/milestone-2/README.md` for database rehearsal guidance. Live calendar import, Vault consent, and multi-account behavior remain separate acceptance checks under A-05.
