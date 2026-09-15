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
- Milestone 3 is The Hearth. Obtain its requirements and acceptance criteria before implementation; navigation labels are not a feature specification.
- Update the handoff when scope, implementation status, or verification results change. Distinguish recorded results from checks run in the current session.

## Security and verification

- Do not read or print credential values, commit private environment files, or expose server credentials to browser code.
- Preserve server-verified ownership for privileged character writes, official server-fetched profile data, and selected-Lodge sharing restrictions.
- Preserve the Milestone 2 security tests. Use their README for database rehearsals; never apply the disposable baseline to the original database.
- Run checks appropriate to the change and report what actually ran, including limitations. Review the diff and stage only intended files.
