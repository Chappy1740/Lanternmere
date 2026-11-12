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

Master: [shared engineering standard](https://github.com/Chappy1740/eydren-governance/blob/main/governance/EYD-ARCH-001.md). The local rules below remain enforceable when the private master is inaccessible.

Before implementing a new feature or adding a significant dependency:

1. Inspect the relevant existing code and declared dependencies first. Reuse working project functionality; do not replace it solely because an alternative exists.
2. Perform a brief, targeted search for established solutions when reuse is likely to save meaningful time. Prefer already-installed packages, platform capabilities, and well-maintained libraries; do not assume that open-source means MIT-licensed.
3. For any proposed third-party dependency, confirm its actual license and obligations, maintenance activity, known security advisories, transitive dependency impact, and compatibility with this project's runtime, architecture, and deployment environment. Never assume a license from a repository's owner or description.
4. Compare three choices: reuse an existing project component, adopt an external library, or implement a small focused solution. Consider implementation effort, long-term maintenance, accessibility, security, reliability, and portability.
5. Record the selection and brief rationale in the task or PR; for a new dependency, record the package/version, license, relevant attribution obligations, and update/security ownership in the project's dependency tracking or PR. Preserve required copyright/license notices.
6. Do not install, upgrade, replace, or bulk-audit dependencies without task scope and appropriate authorization. Do not let research become a blocker for small straightforward changes; timebox the investigation proportionately.

Apply this check during feature planning, not as an excuse to refactor unrelated or already-accepted functionality. Preserve all existing project security, verification, approval, and Git rules.

Third-party AI content (skills, plugins, MCP servers, custom GPTs, prompt packs, agent templates) counts as a dependency under this check: review it read-only first, install nothing from unreviewed sources, and use permission-bypass modes only in isolated sandboxes. Purchased or shared content is for learning; do not republish or resell it through Eydren.

## EYD-PM-001 v3.3 — Conversation continuity and recovery

Master: [EYD-PM-001](https://github.com/Chappy1740/eydren-governance/blob/main/governance/EYD-PM-001.md), with its handoff template, recovery checklist and acceptance tests in the central `templates/` directory and `governance/EYD-PM-001-ACCEPTANCE.md`. The master repository is private; the rules below apply here on their own.

- Chat history and agent memory are temporary. Current owner direction and approved requirements determine intent and authorization; fresh evidence determines actual state. Verify current evidence (branch, HEAD, remote head, PRs, checks, deployment or version IDs) against `docs/project-status.md`, `docs/project-tracker.json` and dated handoffs; record discrepancies. Unverified chat summaries rank last.
- At significant checkpoints, evaluate **Is it still necessary to continue this chat?** Report state, reason, evidence checked and next step; do not invent context percentages.
- Assess continuity at milestones, phase changes, significant decisions and before approval requests. **GREEN:** continue. **AMBER:** record chat-only decisions, approvals or results in `docs/project-status.md` and `docs/project-tracker.json` before continuing. **RED:** stop new implementation and prepare a verified handoff. **RECOVERY:** read-only verification for the affected scope until records and evidence agree. Never use chat length or an invented context percentage as the measure.
- A handoff states project and repository, objective and phase, verified branch and full SHA, each item at one rung (Implemented, Tested, Merged, Deployed, Owner-accepted), decisions and requirements with where they are recorded, blockers, approvals with exact remaining scope, evidence, unknowns and discrepancies, and one next action with acceptance criteria. Store it in or link it from `docs/project-status.md` and `docs/project-tracker.json`; never start a competing record.
- Before resuming dependent work from a handoff or new chat, verify repository, branch, HEAD, remote head, working tree, decisions and approvals against these sources. Report Recovered, Partially recovered or Not recovered with evidence; never claim Recovered without it.

This section grants no new permission and relaxes no rule in this file.

### Task coordination

- **Check before starting.** Verify the repository, target branch and full task head, local working tree where accessible, open PRs, overlapping branches and active runs. Record unavailable evidence as UNKNOWN in the existing project handoff. Coordinate overlapping tasks before editing. Avoid duplicating migrations, hosted tests and deployments.
- **One writer per task.** Record the assigned implementer, approved scope and affected files in the existing handoff or PR. Codex and Claude may work on separate, nonoverlapping tasks. Branch prefixes identify provenance. A transfer requires owner approval, preservation of existing work, the source branch and full SHA, and a verified handoff. Continue from the verified source head on a separate branch.
- **Review handshake.** Record review findings in the PR with severity, file and line, evidence and a suggested fix. The assigned implementer handles fixes unless the owner approves a transfer. Before recommending merge, verify the intended base, full PR head, changed files, dependencies and conflicts, required CI on that head, independent review, resolved threads and explicit owner merge approval. Recheck after the head or base changes. Attribute each check to the agent and session that ran it.
- **Formal handoffs.** Use the central templates. From the governance repository, validate a new handoff with `python3 -I tests/handoff_check.py <handoff.md> --require-coordination`. Verify recovery and authorization separately.
- **Scoped owner delegation.** The owner sets priorities, scope, acceptance and final approvals. Delegation covers only the named actions. Obtain explicit authorization for merges, deployments, provider or live database and authentication changes, sharing and spending. Preserve the Codex session rules, existing execution locks, server-verified ownership, RLS and Lodge sharing restrictions.

## EYD-MODEL-001 — Mandatory model suitability and STOP gate

Canonical approved standard: https://github.com/Chappy1740/eydren-governance/blob/main/governance/EYD-MODEL-001.md (private). These local instructions apply independently if the canonical document cannot be accessed.

Before substantial architecture, coding, review, analysis, or tool-intensive work, identify task complexity, risk, data restrictions, available capabilities and budget. Verify the active model and reasoning effort using supported session information **when accessible**; otherwise report **UNKNOWN**, never guess from output style or claim to control an inaccessible model selector. Check current model availability and capability against the task's requirements using provider-supported information when accessible. Recommend the least costly suitable available model/effort, without compromising safety, quality or compliance. Record the current model (or UNKNOWN), recommendation, reason, cost implication and PASS / STOP / UNVERIFIED in the existing task or PR when material.

**Mandatory STOP:** If the current model is verifiably unsuitable for the assigned work, stop the affected work immediately, explain the mismatch, recommend a suitable available model and reasoning effort (or explain how to verify available choices), give switch/resume guidance, and await the owner's decision. Do not silently switch models or providers, transfer task ownership, or claim a model switch happened. UNKNOWN is not proof of a mismatch: request verification when material, and restrict work to low-risk, model-independent discovery until resolved. Reassess after significant scope/risk changes, model/provider changes, context recovery, usage exhaustion and handoffs.

Use included allowances first; do not spend purchased credits, invoke billable APIs, change provider settings, merge, deploy, or expand approvals without separate explicit authorization. Model recommendations are advice, not an automatic selector or evidence of platform enforcement. Preserve all stricter local security, execution-lock, review and approval rules. For public repositories, this self-contained summary remains binding even when the private canonical link is inaccessible.
