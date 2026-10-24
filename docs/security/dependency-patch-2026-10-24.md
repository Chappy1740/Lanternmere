# Dependency security patch — October 24, 2026

## Scope and release state

Prepared from GitHub main `094b71aae06e83f7354af694e59288ca5b323406` in an isolated checkout. The owner authorized local verification, commits, a review-branch push, and email reporting. Production merge, deployment, provider changes, and live account/database exercises remain separate approval scopes. This report does not establish a deployed fix or security clearance.

## Dependency changes

| Package                  | Previous | Candidate |
| ------------------------ | -------- | --------- |
| next                     | 16.3.5   | 16.4.1    |
| react                    | 19.2.8   | 19.2.9    |
| react-dom                | 19.2.8   | 19.2.9    |
| react-server-dom-webpack | 19.2.8   | 19.2.9    |
| eslint-config-next       | 16.3.5   | 16.4.1    |

The five exact releases, MIT license metadata, integrity metadata and peer ranges were read directly from npm. Existing vinext beta.13 permits the selected React versions. No application code, SQL, RLS, auth policy, or provider configuration changed. Lifecycle scripts were disabled for installation; both builds subsequently succeeded without enabling them.

The lockfile contains **sharp 0.35.5 under Next** and a separate **sharp 0.35.4 used by Miniflare**. The latter is an exact toolchain pin; a targeted `npm update sharp` did not remove it. Do not confuse the remaining toolchain copy with Next's repaired image dependency.

Primary advisories: [Next October 14 update](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [React RSC remote-code-execution advisory](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3), and [React Server Functions denial-of-service advisory](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453). Advisory applicability to a specific deployed path requires separate verification; no exploit was attempted.

## Verification performed in this session

- Node 24.19.0 and npm 12.0.2; isolated checkout with synthetic build values, without copying private environment files.
- Full ESLint pass; focused lint after the test-only repairs below.
- Next production build and local vinext/Workers bundle build passed.
- Next route-type generation and TypeScript `--noEmit` passed.
- Initial test inventory: 42 mocked script entry points; 39 passed and three failed. All three errors also reproduced on the original, unchanged dependency baseline.
- Repaired three stale harnesses in a separate change: load the real character-details parser; target the current personal Hearth route with its Zod/query dependencies and add a no-Lodge regression; provide a throwing redirect stub for the expanded Traveler action module. Existing denial and failure assertions remain.
- Final run: **42 of 42 script entry points passed**. These are mocked checks, not hosted browser or live-database acceptance.
- Lockfile scan found no non-npm resolved package origin or missing integrity field among resolved entries. Install-script flags remain on esbuild, workerd, unrs-resolver and the optional macOS fsevents package. This static metadata scan is not proof of package trustworthiness.
- Source searches found no application `eval`, dynamic Function construction, raw HTML rendering or TLS-verification bypass in the searched TypeScript/TSX paths. The build wrapper's child-process spawn is expected. This is a bounded source check, not a complete independent backdoor audit or fresh history-secret clearance.

## Findings that remain open

`npm audit --omit=dev` reported **14 affected package nodes: eight high and six moderate; zero critical**. The affected names were `@cloudflare/vite-plugin`, `@vercel/og`, `@vinext/cloudflare`, `fast-uri`, `fflate`, `miniflare`, `satori`, `sharp`, `source-map-js`, `undici`, `vinext`, `vite`, `wrangler`, and `zod`. The omitted-dev graph still contains tooling reached through runtime-declared vinext packages. Counts include transitive propagation and do not establish 14 independently exploitable hosted defects. Audit output alone is not complete coverage of framework advisories.

Do not use `npm audit fix --force`: it suggested incompatible vinext/adapter downgrades for part of the graph. The additional dependency changes need a separately scoped compatibility review. Registry-verified candidates include Zod 4.6.6 and Vite 8.3.3. Wrangler 4.149.0 and Cloudflare Vite plugin 1.63.1 point to Miniflare 5.20261006.1-alpha; that toolchain transition needs explicit review rather than an automatic upgrade. Satori's exact fflate pin also needs upstream review. No additional candidates were installed.

Workers Free CPU reliability, cross-account Signal Fire privacy, password recovery, hosted schema/settings, retention, stale-session suspension and physical iPhone acceptance remain open. The original Claude report's code/history claims are supplied review evidence; they were not independently repeated in full here. No guarantee that vulnerabilities or backdoors are absent is made.

## Release and rollback gates

Keep the review PR unmerged. Before any production release, approve the exact residual-risk disposition, record the actual current Worker version and compatible rollback target, verify the connected branch/deploy configuration, then approve merge/deployment separately. The Cloudflare browser session required sign-in, so current provider settings and version were not freshly attested.

Revert only this patch's reviewed commits on the review branch if needed; preserve unrelated work and avoid force-pushing. A production rollback requires its own approved Worker-version restoration. This patch changes no schema and supplies no database rollback operation. Do not edit the tracker to close live acceptance items on the strength of these local results.
