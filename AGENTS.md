<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lanternmere project guidance

## Read first

- Read `README.md` and `docs/project-status.md` for the current handoff.
- Use `docs/project-overview.md`, `docs/architecture.md`, and `docs/development.md` for project context and verification guidance.
- Preserve `docs/milestone-2-checkpoint.md` and `tests/milestone-2/README.md` as historical evidence and regression guidance.
- Check the actual branch and working tree each session; documented branch state is historical.

## Working agreement

- Keep user-facing guidance concise and proceed one step at a time.
- Inspect relevant source before editing; preserve unrelated user changes.
- Preserve the generated Next.js instruction block above and follow its installed-documentation requirement before coding.
- Keep documentation-only tasks limited to documentation. During the initial documentation handoff, review the diff with the user and commit it before beginning Milestone 3 product work.
- Milestones 0–4 are implemented. The pre-Milestone-5 consolidation and UI/design-alignment checkpoint must preserve product behavior; navigation labels are not a feature specification.
- Update the handoff when scope, implementation status, or verification results change. Distinguish recorded results from checks run in the current session.
- During milestone work, record new user requests and scope decisions in `docs/project-tracker.json` using `docs/project-tracker.md`. Update tracked work and acceptance states when evidence changes so the public `/status` page remains useful across sessions.

## Security and verification

- Do not read or print credential values, commit private environment files, or expose server credentials to browser code.
- Preserve server-verified ownership for privileged character writes, official server-fetched profile data, and selected-Lodge sharing restrictions.
- Preserve the Milestone 2 security tests. Use their README for database rehearsals; never apply the disposable baseline to the original database.
- Run checks appropriate to the change and report what actually ran, including limitations. Review the diff and stage only intended files.

# Lanternmere Project Instructions

Before making project changes, read and follow `docs/CODEX_SESSION_RULES.md`.

GitHub and the repository documentation are the source of truth. Keep work focused on the current task, inspect only the files needed, avoid unrelated changes, and follow the model/session-efficiency guidance in the permanent Codex rules.

## EYD-ARCH-001 — Reuse Before Build

Before implementing a new feature or adding a significant dependency:

1. Inspect the relevant existing code and declared dependencies first. Reuse working project functionality; do not replace it solely because an alternative exists.
2. Perform a brief, targeted search for established solutions when reuse is likely to save meaningful time. Prefer already-installed packages, platform capabilities, and well-maintained libraries; do not assume that open-source means MIT-licensed.
3. For any proposed third-party dependency, confirm its actual license and obligations, maintenance activity, known security advisories, transitive dependency impact, and compatibility with this project's runtime, architecture, and deployment environment. Never assume a license from a repository's owner or description.
4. Compare three choices: reuse an existing project component, adopt an external library, or implement a small focused solution. Consider implementation effort, long-term maintenance, accessibility, security, reliability, and portability.
5. Record the selection and brief rationale in the task or PR; for a new dependency, record the package/version, license, relevant attribution obligations, and update/security ownership in the project's dependency tracking or PR. Preserve required copyright/license notices.
6. Do not install, upgrade, replace, or bulk-audit dependencies without task scope and appropriate authorization. Do not let research become a blocker for small straightforward changes; timebox the investigation proportionately.

Apply this check during feature planning, not as an excuse to refactor unrelated or already-accepted functionality. Preserve all existing project security, verification, approval, and Git rules.

## Codex and Claude Code tandem

Codex and Claude Code both follow this file (Claude Code loads it through `CLAUDE.md`, which imports `@AGENTS.md`). These rules bind both agents and add to, never relax, the rules above.

- **One writer per task.** A branch belongs to the agent that created it: `codex/<task>` or `claude/<task>`. Never commit to, rebase, or force-push the other agent's branch. To continue another agent's work, branch from its head under your own prefix and say so in the handoff.
- **Default roles.** Codex implements approved scope. Claude Code reviews and advises: read-only PR review, audits, architecture and risk analysis, and teaching. The owner may swap roles for a specific task; record that in the handoff.
- **Review handshake.** Implementation ends as a draft PR with its handoff or receipt. Review findings go in PR comments with severity, file:line, evidence and a suggested fix. The implementing agent applies fixes; a reviewer does not push fixes unless the owner assigns that task.
- **Check before starting.** Fetch, then check open PRs, `codex/*` and `claude/*` branches touching the same files, and any active run recorded in the handoff. Never duplicate another agent's active run, resources, migrations, deployments or hosted tests; coordinate through the owner.
- **One shared memory.** `docs/project-status.md` with `docs/project-tracker.json` is the only cross-agent record. Chat history and agent-local memory are not shared. Record approvals there or in the PR with their exact scope, so either agent can carry them forward without asking again and without widening them.
- **Same evidence rules.** State which agent ran which checks in the current session, keep stage labels distinct, and never present another agent's recorded results as freshly verified.
