# Milestone 2 — Travelers and Characters

Status: scope complete; final tests and handoff documentation prepared September 15, 2026.

Repository: Lanternmere. Branch: milestone-2-travelers-characters.
Milestone 1 baseline: 82b4d70. Security implementation: a4f392c.
Dependency fixes: 15b0a49, pushed to GitHub. This documentation/test preservation is the subsequent change.

## Verified

- Region/realm/name import, normalized character and atomic snapshot save, official public profile retrieval on the server.
- Character cards/details, source and refresh timestamp, Main/alternate switching, selected Lodge sharing.
- Manual uppercase normalization, invalid name rejection, unavailable-profile handling, existing-character refresh without duplicates or lost Main/sharing state.
- 13 mocked profile-client checks passed, including throttling and integration failures. No real Blizzard requests or credentials used by the tests.
- Security migration 20260915022529 applied to original Lanternmere database only after disposable-database rollback regression tests passed and CLI dry-run listed exactly that migration.
- Separate rollback checks confirmed original function restored, new function absent, and test users removed in the disposable database.
- Two-account browser verification: unshared character returned 404; sharing enabled a Shared Lodge character view with no owner controls; unsharing restored 404.
- Temporary membership used for browser testing removed: DELETE returned one membership ID. Original unchecked sharing setting restored. Both real user accounts and their original Lodges retained.
- npm audit reported 0 vulnerabilities; lint and production build passed on Next.js 16.3.5. eslint-config-next 16.3.5, sharp 0.35.4, js-yaml 4.3.2.
- Desktop Blizzard configuration corrected privately; .env.local ignored and never included in these artifacts.

## Handoff

Tests and execution guidance: tests/milestone-2/README.md. The disposable test database remains at pre-security-migration schema. Do not run its baseline or rehearsal against the original database.

No concurrent multi-session race test or exhaustive browser-level malicious request testing was performed. Database regression checks exercised cross-user denials. A historical comment in the applied migration attributes trusted ownership to RLS; service-role writes actually rely on the server-verified owner ID. Application behavior was not changed for that comment.

Next milestone is 3 — The Hearth. Obtain its scope before implementation. Keep guidance concise, use up to three manual steps, preserve security tests, and do not read or print credentials.
