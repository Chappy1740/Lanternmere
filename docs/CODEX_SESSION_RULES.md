# Lanternmere Codex Session Rules

These rules are permanent project guidance for Codex sessions working on Lanternmere.

## Source of Truth

- GitHub and the repository documentation are the source of truth.
- Read this file before making project changes.
- Use the current milestone documentation and existing code instead of reconstructing project history from old chat conversations.
- Inspect the repository before claiming current file contents, commits, branch, or Git status. Treat previously recorded repository state as historical until verified.

## Session Efficiency

- Use the smallest capable model for the task.
- Default to Terra Medium for normal coding, dashboard layout, components, routine fixes, and tests.
- Use Sol Medium for connected multi-file features, complicated data work, or difficult implementation decisions.
- Reserve Astra for difficult Supabase/RLS/security issues, serious unresolved bugs, and major architecture or refactor work.
- Do not reread or broadly analyze the entire repository when the requested task is narrow.
- Inspect only the files and documentation needed for the current task, expanding scope only when evidence shows it is necessary.
- Do not repeat repository discovery that permanent documentation already answers.
- Keep a Codex chat focused on one task or a closely related group of tasks.
- Start a new focused Codex chat when the work changes substantially or the current chat has accumulated substantial unrelated context.
- Prefer a short task-specific prompt that points to repository documentation over pasting large amounts of historical chat context.
- Stop after the requested task, relevant validation, and a concise result report unless additional work is explicitly requested.

## Implementation Discipline

- Preserve existing architecture unless the task requires a deliberate change.
- Do not modify unrelated files.
- Prefer focused, maintainable changes over broad rewrites.
- Follow existing naming, formatting, and project conventions.
- Before editing, identify the smallest reasonable set of files involved.
- Run the checks relevant to the changed code. Do not run expensive or unrelated validation without a reason.
- Report failures clearly rather than hiding or working around them silently.

## Git Discipline

- Work on the branch specified for the current milestone or task.
- Check the working tree before making changes.
- Do not overwrite unrelated uncommitted work.
- Review the diff before considering the task complete.
- Keep commits focused and descriptive.

## Session Handoff

- End each coding session with a concise status and next-step handoff: what changed, verification actually run, unresolved issues or limitations, and the next concrete step.
- Distinguish checks run in the current session from previously recorded results.
- Update docs/project-status.md when scope, implementation status, or verification results change.

## Current Lanternmere Workflow

For Milestone 3 — The Hearth:

- Branch: `milestone-3-the-hearth`
- Follow the durable model-selection guidance under Session Efficiency.

These model choices are workflow guidance for conserving usage while maintaining implementation quality; they do not change the technical requirements of the project.
