# Guard-bash hook: shell-parser library evaluation

**Date:** 2026-11-10 · **Author:** Claude (Claude Code cloud session) · **Status:** Draft recommendation for owner review. Nothing installed, committed or pushed.

## Question

Should `.claude/hooks/guard-bash.mjs` replace its hand-written shell parsing with a maintained parser library, to remove the over-blocking and coverage limits accepted in Lanternmere #30, DiamondAlibi #92 and eydren-studio #35?

## Recommendation

**Option (a): keep the dependency-free hand-written parser, extend the tests, and close the fail-open paths.** Do not adopt a library now.

- A library would fix the three over-blocking cases, but **none** of the "not covered" cases: `find -name '.env*' -exec cat`, `rg -g` and `grep -r` are tool semantics, not parsing. Every parser reports them as harmless words.
- Every library option adds a failure mode that is worse than the over-blocking it fixes. `node_modules` is gitignored, so a fresh checkout (cloud session, Codex, a new clone) does not have it. If the hook cannot import its parser, it exits 1, and **Claude Code allows the command** (exit 1 is a non-blocking error). Adding `"onFailure": "block"` instead blocks *every* Bash command, including the `npm ci` that would fix it. The only safe library route is vendoring the parser into `.claude/hooks/`, which three repositories would then have to keep patched.
- The best-fit library (unbash) is nine months old, has one maintainer and had six major releases in eight months. That is too much churn for a security seatbelt copied into three repositories.
- For the cases no parser can cover, the right tool is Claude Code's Bash **sandbox** with `denyRead`, which blocks at the operating-system level. That is a separate settings decision (below), not part of this change.

## Evidence checked this session

| Item | Result |
| --- | --- |
| Hook files | Lanternmere `main` 57ff0b8 and eydren-studio `main` 966177f: byte-identical (`guard-bash.mjs` sha256 `f0297e66…`, `guard-bash.check.mjs` `308b0726…`). DiamondAlibi: identical **only** on `claude/setup-audit-reference-suxt0i` @ 689be07. DiamondAlibi `main` 2c9bf02 still has the older hook without the wildcard rule. PR #92 state was not read (that repo is not attached for API access): UNKNOWN. |
| Regression suite | `node --test .claude/hooks/guard-bash.check.mjs`: 86/86 pass (Node 22.23.4). |
| Accepted limits | Reproduced. Over-blocked (exit 2): `bash -c "rg '\.env.*' .gitignore"`, the quoted heredoc case, `bash --version; echo '.env*'`. Allowed (exit 0): `find … -exec cat`, `grep -r`, `rg -g '.env*'`. |
| New findings | Allowed (exit 0): `cat $'\x2eenv'` (ANSI-C quoting), `f=.e; cat ${f}nv` (variable). Malformed hook input (`not json`) exits 0. An uncaught exception would exit 1. Both allow the command. |
| Claude Code behavior | From the current hooks docs: exit 2 blocks; any other non-zero exit, a crash or a timeout **allows** unless the hook sets `"onFailure": "block"` (v2.1.295+; this container runs 2.1.322). |
| Sandbox | From the current sandboxing docs: `sandbox.filesystem.denyRead` and `Read()` deny rules restrict Bash commands (`find`, `grep -r`, `cat`) on macOS, Linux and WSL2. Native Windows runs unsandboxed. If the sandbox is unavailable, commands run unsandboxed unless `sandbox.failIfUnavailable` is set. This cloud container has no `bubblewrap`, so the sandbox would likely not apply here. |
| Advisories | Checked through the npm registry bulk-advisory endpoint (GitHub Advisory Database). OSV.dev was blocked by this session's network policy. |

Package metadata came from the npm registry. Licenses were read from the LICENSE file inside each published tarball, downloaded to a scratch folder with `npm pack --ignore-scripts`. No package code was run: executing downloaded code was refused by the session's safety classifier, so parser behavior below comes from the package source and README, not from tests.

## Candidates

| Package (latest) | Actual license | Maintenance | Advisories (latest) | Deps / size | Handles quoting, `$( )`, braces, heredocs? | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| `shell-quote` 1.12.0 | MIT (LICENSE file) | Active; 4 maintainers; last release 2026-10-02 | None for 1.12.0. Past: 2 critical, 1 high (all ≤1.8.4), including a `parse()` DoS | 0 deps, 64 KB | Tokenizer only. No heredocs, no brace expansion, no nested-substitution tree | **Reject.** Does not fix the limits |
| `bash-parser` 0.5.0 | MIT (LICENSE file) | Last release 2017-06-22. The archived community fork confirms it is abandoned | None listed | 21 deps, including deprecated `babylon` 6 | POSIX-oriented; misses Bash syntax | **Reject.** Abandoned |
| `mvdan-sh` 0.10.1 (GopherJS build) | BSD-3-Clause | **Deprecated** on npm (mvdan/sh#1145) | None listed | 1.5 MB | Full | **Reject.** Deprecated |
| `sh-syntax` 0.8.3 (mvdan/sh 3.14.1 as WASM) | Package LICENSE is MIT, but `main.wasm` is compiled from mvdan/sh (BSD-3-Clause) and ships Go's `wasm_exec` (BSD-style). Those notices are **not** in the package, so vendoring it would need extra attribution work | 1 maintainer; 3 releases in 3 days | None listed | 0 deps, 3.9 MB; async WASM start-up | Full, the most mature parser | **Not now.** Heavy, async, attribution gap |
| `web-tree-sitter` 0.27.2 + `tree-sitter-bash` 0.25.1 grammar | MIT (both LICENSE files) | Active, many maintainers | None listed | 4.6 MB runtime + grammar `.wasm` (the grammar package is 20 MB with native builds and an `install` script); async start-up | Good. Error-tolerant: bad input gives ERROR nodes, not a failure, so the hook must treat any error node as a block | **Not now.** Heavy, async |
| `unbash` 6.0.4 | ISC (LICENSE file; notice must be kept) | Created 2026-02-25; 1 maintainer; v1→v6 between Feb and Oct 2026 | None listed | 0 deps, 488 KB (~8,000 lines); synchronous | Bash 5.3: heredocs, nested substitutions, brace-expansion parts, ANSI-C quoting. Tolerant parser that returns `errors`. Treats `bash -c '…'`/`eval` bodies as plain words, so we would still re-parse them ourselves | **Best fit if a library is ever adopted.** Revisit later |

Even with unbash, the project would keep its own policy code: brace expansion into candidate names, glob-to-RegExp, `.example` handling, and nested-shell re-parsing. A library replaces about 90 of the hook's 270 lines (`shellWords`, `substitutionEnd`).

## Options compared

| | (a) Keep and extend | (b) Adopt a library (vendored unbash) | (c) Narrow rule: block any unquoted wildcard whose literal name starts with `.` |
| --- | --- | --- | --- |
| False positives | Three accepted cases remain. Two can be narrowed cheaply (see plan) | Removes all three | **Worse**: blocks `cat .prettier*`, `cat .eslint*`, `ls .dockerignore*` (current allowed tests) |
| Bypass risk | Same as today, plus ANSI-C and fail-open fixes | Slightly better: real ANSI-C and heredoc handling | Same as (a). It still needs the quote-aware tokenizer, and it doesn't help nested shells |
| Not-covered cases | Not fixed (needs sandbox) | Not fixed (needs sandbox) | Not fixed |
| Maintenance | ~270 lines we own; each review round has found edge cases | ~8,000 vendored lines in three repos, plus license notice and update tracking | Smallest rule, but still owns the tokenizer |
| Portability | Node only; works in every checkout | Works only if vendored; `node_modules` is absent in fresh checkouts | Node only |
| Failure mode | Fix to fail closed (exit 2 on any internal error) | Missing or broken import → exit 1 → **allowed**, unless vendored and wrapped | Same as (a) |

(c) is effectively what `couldNameSecret` already does, but more precisely, so it is not a simplification.

## Proposed change for option (a)

Same files in all three repositories:

1. **Fail closed.** Malformed JSON → exit 2. Wrap the rule checks in `try/catch` → exit 2. Keep "no command" → exit 0.
2. **Close ANSI-C quoting.** Treat an unquoted `$'…'` word as uncertain (set `state.anomaly`), so the strict check runs. If decoding is cheap, decode `\xHH`/octal escapes instead.
3. **Optional narrowing** (owner's choice): only switch to strict mode for a nested shell when it is followed by `-c` (or for `eval` with arguments). That fixes `bash --version; echo '.env*'`. Skip quoted-delimiter heredoc bodies (`<<'EOF'`, `<<"EOF"`). The `bash -c` quote-stripping over-block stays.
4. **Document what stays uncovered:** variable expansion (`${f}nv`) and tool-applied globs or recursion. No static check can see these. The sandbox can.

## Test plan (extends `guard-bash.check.mjs`)

- Keep all 86 current cases unchanged. Any change in their results fails the change.
- Add `blocked`: `cat $'\x2eenv'`, `cat $'.env'`, `cat $'\056env'`.
- Add raw-input cases: `not json` → 2; `{"tool_input":{}}` → 0.
- Add a fault-injection case. A tiny wrapper runs the hook with a rule that throws and expects exit 2.
- If step 3 is approved: move `bash --version; echo '.env*'` and the quoted-heredoc case to `allowed`. Add `bash -c 'cat .env*'`, the unquoted heredoc `<<EOF` with `$(cat .env*)` inside, and `eval "cat .e?v"` to `blocked`.
- Record the known gaps as named `todo` tests (`node:test` `{ todo: true }`), so they appear in the output without failing: `${f}nv`, `find -exec`, `grep -r`, `rg -g`.
- Run the suite in each repository, compare `sha256sum` across all three, and run one end-to-end check through the configured hook command.

## Separate, later decision: sandbox `denyRead`

Enabling `sandbox.enabled` with `filesystem.denyRead` entries for `**/.env`, `**/.env.*`, `**/.dev.vars*` (keeping `allowRead` for `*.example`) would cover `find`, `grep -r` and `rg -g` at the operating-system level on macOS, Linux and WSL2. Open questions before proposing it:

- Which Claude Code versions and platforms the owner's machines run (native Windows is unsandboxed).
- Whether cloud sessions can use it (no `bubblewrap` here). Do not set `failIfUnavailable`, or cloud sessions would refuse to start.
- Its effect on `npm`, `wrangler` and `git`, which must still work.

Tabled as a future patch.

## Revisit a library when

unbash has gone 12 months without a major release or gained a second maintainer, or the hook's job grows beyond secret files (for example, a general command allowlist).

## Approvals needed

Each is a separate owner approval:

1. Commit this document (and a `docs/project-status.md` entry) on `claude/brave-hypatia-03ycfo` and push it, in Lanternmere.
2. Choose option (a), and say whether step 3 (narrowing) is included.
3. Implement and test it on a branch in each repository. That needs push access for DiamondAlibi and eydren-studio, which is not attached for writing in this session. **First, decide how DiamondAlibi PR #92 lands**: its `main` lacks the wildcard rule, and only one writer may work on that file at a time.
4. A draft PR per repository, then a merge approval per PR after CI and review.
5. (Later, separately) the sandbox `denyRead` settings change.
