# Pull request validation and main safeguards

The `validate` job in `.github/workflows/ci.yml` reuses the pinned lockfile, existing lint, all mocked CJS/MJS test entries, Next build, TypeScript and Workers bundle build. Node is pinned in `.nvmrc`; Actions are pinned to the same immutable commits already used by Diamond Alibi. No new package is added and install lifecycle scripts remain disabled.

`npm run test:mocked` discovers the existing mocked entries, runs each in a separate process, reports every failure, and fails the job if any entry fails or times out. This initially covers 42 scripts. SQL rehearsals are excluded and must never run against a hosted or original database as part of CI. Tests and builds use synthetic loopback configuration, no repository secrets, no hosted accounts and no deployment command. There is no browser or database-acceptance claim.

## Required repository rule

After this branch's `validate` job succeeds, configure main to require PRs, resolved review threads, an up-to-date successful `validate` check from GitHub Actions, no deletion and no force pushes. Use no bypass actors. Zero required approving reviews accommodates the solo owner; it does not replace the documented independent-review handshake. Verify actual settings after applying them: a committed workflow or proposed JSON is not enforcement.

Cloudflare's existing build/deployment connection is unchanged. Requiring validation before merge prevents unvalidated source from entering main, but this workflow is not an exact-commit production deployment gate and does not validate hosted settings.

## Applied setting and validation receipt — October 30, 2026

GitHub readback confirmed active [main-validation ruleset 26202441](https://github.com/Chappy1740/Lanternmere/rules/26202441): main-only, required up-to-date Actions `validate`, PR/resolved-thread requirement, no deletion/force pushes, no bypass actors, zero mandatory approving reviews. The [first PR workflow run](https://github.com/Chappy1740/Lanternmere/actions/runs/41047970760) passed every step on source `2e3a0e88c619ccc2568215ea1ad8e386017c2846`. Later commits require their own checks.

Codex also ran all 42 mocked scripts, lint, targeted formatting, Next build, Workers build, regenerated route types and TypeScript locally. Next needed a bounded clean-output retry after a blocked font download and Windows Turbopack subprocess failure. Running Workers after Next rewrote generated route types; regenerating with `next typegen` resolved the subsequent local type-check mismatch. CI checks TypeScript before the Workers build. The local Workers build succeeded with the existing vinext warnings and a sandbox debug-log write warning. No application-source workaround or provider change was made.

## Limits and rollback

Known dependency-security findings remain tracked in `docs/security/dependency-patch-2026-10-24.md`. This workflow does not run an audit, upgrade dependencies, suppress audit findings or establish security clearance. Hosted privacy, rank-0 claims, CPU reliability and physical-phone acceptance remain separate gates.

Preserve the checks when a test fails; diagnose on a task branch rather than bypassing the ruleset. Roll back a faulty CI-only change with a focused reviewed revert. Provider rollback, live data/auth changes and product release require their own scope and approval. Do not disable main safeguards to merge an unrelated blocked PR.
