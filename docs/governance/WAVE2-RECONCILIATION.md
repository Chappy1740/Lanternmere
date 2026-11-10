# Wave 2 — Golden Standard reconciliation coordination (proposal)

Status: **documentation-only coordination proposal; NOT adopted policy, NOT owner acceptance, NOT merged.**
Date: 2026-11-10. Repository: `Chappy1740/Lanternmere`. Baseline main: `cebf0828e5a41fba3cde97613cb41a87d4128ae4` (reverify before integration).

## Ownership and overlap

- Repository owner and final approver: `Chappy1740`. Agent ownership is temporary responsibility for a task/branch, not repository authority.
- Existing draft PR #20 changes `AGENTS.md`. Do not alter that branch, overwrite its author, or open a competing `AGENTS.md` change. Have the implementing agent reconcile PM v3.3 into its existing draft after the owner assigns that task, then request independent review.
- An agent switch requires a recorded task, scope, current branch and exact head SHA, affected files, verified evidence, outstanding checks and one next action. A transfer never expands permission to merge, deploy, change provider settings, or bypass locks.

## Proposed PM v3.3 adoption checks (not implemented here)

1. Read the current approved `EYD-PM-001` and `EYD-ARCH-001` from governance main; distinguish proposed amendments from approved policy.
2. Verify GitHub main/head, PRs, checks, review threads and current project handoff; report unknown local working-tree state honestly.
3. Use one writer per task; permit parallel nonoverlapping branches and approved transfers. Never rebase, push, or overwrite another agent's active branch without a specifically approved transfer.
4. Retain explicit owner approval for consequential actions, with separate exact-head CI and independent review gates before recommending a merge. An open PR is not merged; tests are not deployment or owner acceptance.
5. Preserve GREEN/AMBER/RED/RECOVERY continuity and existing project-specific handoff locations; avoid competing trackers.
6. Preserve existing execution and security locks: Preserve generated Next.js AGENTS block, current Codex session rules, milestone 0–4 behavior, ownership/RLS, database and auth restrictions. Coordinate with open PR #27 touching docs/CODEX_SESSION_RULES.md and docs/project-status.md; no changes to those files.

## Verification and acceptance

- This file is a proposed reconciliation plan only. No project agent instructions, runtime code, provider configuration, rulesets or existing PRs are modified by this branch.
- Next: owner-directed handoff to the current `AGENTS.md` PR writer, independent review of the resulting updated head, and separate owner approval before integration.
- Evidence stages: Implemented (plan only); Tested (GitHub readback pending); Merged (no); Deployed (no); Owner-accepted (pending).

## PR #20 retention assessment — 2026-11-10

Compared draft PR #20's entire `AGENTS.md` patch against governance `EYD-PM-001` v3.3 on main and Lanternmere main instructions. Its one-writer-per-task, separate task branches, branch-from-source-head transfer, existing canonical project records, preflight checks, agent-attributed evidence and owner-scoped authorization are already substantially covered. Do not merge duplicate or stricter branch-prefix-as-ownership language: PM v3.3 explicitly says prefixes alone do not establish task ownership.

**Retain as a proposed implementation refinement, subject to normal review:** make the review handshake concrete: submit findings in PR review comments with severity, file/line, evidence and a proposed fix; the assigned implementer owns remediation unless the owner explicitly transfers the task. Before beginning overlapping work, check active PRs/branches and active runs to avoid duplicating migrations, hosted tests or deployments. These clarify existing governance rather than creating new permissions. Add them through the existing `AGENTS.md` reconciliation task after assignment; do not silently claim they are already adopted.

**Disposition:** PR #20 is redundant as an integration vehicle, contains an outdated assumption that branch prefix defines ownership, and has a merge conflict. Preserve its GitHub history and this assessment, then close it **without merging**. No deletion of `AGENTS.md` or source branches is needed.
