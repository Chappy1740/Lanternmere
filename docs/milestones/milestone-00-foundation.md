# Milestone 0 — Foundation

## Status
Complete.

## Purpose
Establish the technical foundation required to build Lanternmere safely and consistently.

## Intended features
- Next.js application setup
- React and TypeScript
- Tailwind CSS
- Supabase integration
- environment-variable structure
- application shell and design-token foundation
- initial database schema and migrations
- Row Level Security
- helper functions and repository conventions

## User flow
Milestone 0 is infrastructure-focused and has no primary end-user workflow.

## Architecture and security
- Keep secrets out of source control and browser code.
- Track database changes through migrations.
- Use Supabase RLS as a real security boundary.
- Keep browser and server Supabase usage separated appropriately.
- Prefer maintainable project structure over premature abstraction.

## Acceptance criteria
- Application runs locally.
- Supabase integration works.
- Initial schema and migrations exist.
- Required RLS is enabled.
- Environment variables are documented safely.
- Application shell exists.
- Lint passes.
- Production build passes.

## Milestone boundary
Do not recreate completed foundation work unless later milestones expose a real defect.
