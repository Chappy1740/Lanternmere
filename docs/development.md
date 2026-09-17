# Development and verification

## Session startup

1. Read `AGENTS.md` and [project status](project-status.md).
2. Inspect the current branch, working tree, and relevant source before changing files; preserve unrelated work.
3. Confirm the current task scope. For The Hearth, obtain requirements before implementing the placeholder dashboard.

Before writing Next.js code, follow the generated instructions in `AGENTS.md` and read the relevant installed guides under `node_modules/next/dist/docs/`.

## Local setup

Use Node.js and npm compatible with the checked-in dependencies. Install the locked dependencies from the repository root:

```sh
npm ci
```

Use `.env.example` as the template for private local configuration in `.env.local`. Never commit, print, or copy credential values into documentation, tool output, or chat.

The environment validators name these settings:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser-accessible Supabase configuration.
- `SUPABASE_SERVICE_ROLE_KEY`: private server credential.
- `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET`: required for actual Blizzard profile requests, although optional in the general environment schema.
- `BLIZZARD_REGION`: defaults to `us` in the server schema.
- `BLIZZARD_REDIRECT_URI`: optional in the schema; the inspected token client uses client credentials, not a user redirect flow.

Start the local server with `npm run dev` and open http://localhost:3000. Supabase access and private integration configuration are needed for the connected application flows; installing dependencies does not provision a database.

## Available checks

```sh
npm run lint
npm run build
npm run format:check
node tests/milestone-2/check-profile-errors.cjs
```

The last command uses mocked I/O and requires no credentials or live Blizzard requests. There is no general `npm test` script in the inspected package manifest. `npm run format` writes across the repository; avoid using it for narrowly scoped changes without reviewing everything it changes.

Choose checks appropriate to the change. For documentation-only edits, verify links, factual claims, the preserved generated instructions, and `git diff --check`. Do not report historical lint, build, audit, or browser results as newly run tests.

## Database verification

Follow [the regression-test README](../tests/milestone-2/README.md) exactly for database rehearsals. The baseline scripts are for an empty disposable database at the documented schema state. Never run that baseline against the original Lanternmere database. The checkpoint records the original security migration as already applied; verify current state before any future database work.

The recorded suite does not cover concurrent multi-session races or exhaustive malicious browser requests. Preserve those limitations in future handoffs unless new testing closes them.

## Review and commit

Inspect `git status`, review the changed files and full diff, and stage only intended files. During this documentation phase, show the diff to the user before committing. Product implementation starts only after the documentation commit and agreement on Milestone 3 scope.
