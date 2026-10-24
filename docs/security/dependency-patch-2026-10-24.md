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

Do not use `npm audit fix --force`: it suggested incompatible vinext/adapter downgrades for part of the graph. At the initial checkpoint, additional dependency changes required a separately scoped compatibility review. Registry-verified candidates included Zod 4.6.6 and Vite 8.3.3; their subsequently approved installation is recorded below. Wrangler 4.149.0 and Cloudflare Vite plugin 1.63.1 point to Miniflare 5.20261006.1-alpha; that toolchain transition needs explicit review rather than an automatic upgrade. Satori's exact fflate pin also needs upstream review. No Cloudflare toolchain candidate was installed.

Workers Free CPU reliability, cross-account Signal Fire privacy, password recovery, hosted schema/settings, retention, stale-session suspension and physical iPhone acceptance remain open. The original Claude report's code/history claims are supplied review evidence; they were not independently repeated in full here. No guarantee that vulnerabilities or backdoors are absent is made.

## Release and rollback gates

Keep the review PR unmerged. Before any production release, approve the exact residual-risk disposition, record the actual current Worker version and compatible rollback target, verify the connected branch/deploy configuration, then approve merge/deployment separately. The Cloudflare browser session required sign-in, so current provider settings and version were not freshly attested.

Revert only this patch's reviewed commits on the review branch if needed; preserve unrelated work and avoid force-pushing. A production rollback requires its own approved Worker-version restoration. This patch changes no schema and supplies no database rollback operation. Do not edit the tracker to close live acceptance items on the strength of these local results.

## Approved morning follow-up

The owner approved the emailed Zod/Vite scope after the morning status update on October 24. This follow-up starts at review commit `888d746`, where the connected Cloudflare branch-preview build had passed. That preview result belongs to the earlier commit, not automatically to the follow-up. Production merge, deployment and provider changes remain outside approval.

| Package                    | Previous review version | Approved follow-up | License      |
| -------------------------- | ----------------------- | ------------------ | ------------ |
| zod                        | 4.4.3                   | 4.6.6              | MIT          |
| vite                       | 8.3.1                   | 8.3.3              | MIT          |
| fast-uri (transitive)      | 3.1.8                   | 3.1.9              | BSD-3-Clause |
| source-map-js (transitive) | 1.2.1                   | 1.2.2              | BSD-3-Clause |

The two direct versions are pinned exactly. The transitive updates fit existing parent ranges; there are no overrides or new direct dependencies. Unrelated resolver-selected updates were excluded before verification. The final lockfile changes only these four package versions. Registry release/license/engine/peer/integrity metadata and the installed license files were checked. Vite's Node requirement is met by Node 24.19.0, and installed vinext/plugins permit Vite 8.3.3. `npm ls --all --json` reported no dependency problems. Existing upstream copyright, permission, disclaimer and bundled notices must accompany redistribution; BSD notices also prohibit implied endorsement. The project maintainer retains responsibility for advisory monitoring and future updates.

EYD-ARCH-001 decision: reuse the existing Zod validation and Vite/vinext build integration with maintained security releases. Replacing either library or implementing custom validation/build behavior would increase compatibility and maintenance work without a demonstrated benefit for this patch. No replacement library or hand-written security workaround was added.

Fresh verification for the final four-version lockfile:

- All **42/42** mocked CJS/MJS script entry points passed without test changes; full ESLint passed.
- Next production build and local vinext/Workers bundle build passed using synthetic configuration. A Turbopack CSS-subprocess startup failure persisted on the first retry; removing only this isolated checkout's generated `.next` output and rebuilding resolved it. No configuration or application workaround was introduced.
- Next route-type generation and TypeScript `--noEmit` passed. Dependency peers, lockfile origins/integrity fields and the focused diff were checked. Installations used `--ignore-scripts --no-audit --no-fund`; no lifecycle-script permission was added.
- Fresh `npm audit --omit=dev --json`: **10 affected package nodes, five high and five moderate**, down from 14/eight high/six moderate. Zod, Vite, fast-uri and source-map-js no longer appear as affected nodes. Remaining names: `@cloudflare/vite-plugin`, `@vercel/og`, `@vinext/cloudflare`, `fflate`, `miniflare`, `satori`, `sharp`, `undici`, `vinext`, and `wrangler`.
- Fresh full audit: **11 affected nodes, six high and five moderate**. The extra development-only name is `brace-expansion`; its two locked copies (1.1.18 and 5.0.9) were already present at `888d746` and were not changed. This broader finding was not part of the original runtime-only count.

Relevant primary advisory evidence: [Zod constrained-collection memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [Vite/launch-editor Windows command handling](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [fast-uri scheme normalization](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), [source-map-js indexed-section denial of service](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), and [existing brace-expansion recursion finding](https://github.com/advisories/GHSA-qhr7-859c-m2p7). The saved npm audit outputs include the other advisory IDs. These counts and passing local checks do not close hosted acceptance or establish absence of backdoors.

Rollback for this follow-up is a new revert of its focused commit on the review branch, returning the manifests to `888d746` while preserving the initial framework patch and unrelated work. Reinstall the restored lockfile with lifecycle scripts disabled and repeat the local verification before reusing that candidate. Do not force-push or restore older vulnerable dependencies in production without a separately reviewed incident decision. No schema rollback is involved. The production release/Worker rollback gates above still apply; the current hosted Worker version was not freshly attested.
