# Milestone 14 checks

Run `node --experimental-strip-types tests/milestone-14/briefing-boundaries.test.mjs` for aggregate-only provider context and fixed destination checks.

`budget-assertions.sql` is a synthetic fixture body. Apply the pending migration and this fixture inside **one transaction ending in ROLLBACK**, or run only the fixture against the installed schema inside its own rollback transaction. Never run the fixture alone. It creates only synthetic accounts and Guild records and must leave no data behind. Check aggregate row counts after the rollback.

The fixture checks a verified leader claim, unverified member and cross-Guild denial, six-per-user and 40-per-Guild budgets, direct table denial, and service-only audit completion. A successful fixture does not prove real-account access, AI credentials, provider response, cost, hosted accessibility, or the daily retention run.
