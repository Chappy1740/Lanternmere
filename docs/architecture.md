# Architecture and security boundaries

This is a map of the inspected repository, not a proposal for new implementation.

## Stack and source map

The app uses Next.js App Router, React, TypeScript, Tailwind CSS, Supabase, and Zod. `package.json` and the lockfile are authoritative for dependency versions. At the documentation baseline, Next.js is 16.3.5 and React is 19.2.8.

| Location | Responsibility |
| --- | --- |
| `src/app/(auth)` | Sign-in, sign-up, and account actions. |
| `src/app/(app)/layout.tsx` | Verified user check and shared authenticated shell. |
| `src/app/(app)/(lodge)/layout.tsx` | Lodge membership check; redirects users without membership to Lodge creation. |
| `src/app/(app)/(lodge)/hearth/page.tsx` | Dashboard placeholder. |
| `src/app/(app)/lodges/new` | Lodge onboarding and creation action. |
| `src/app/(app)/travelers` | Character listing, import, details, refresh, Main selection, and sharing controls. |
| `src/components/shell` | Sidebar, topbar, and application shell. |
| `src/lib/navigation.ts` | Navigation labels and destinations. |
| `src/lib/wow` | Identifier validation, Blizzard token retrieval, and public profile client. |
| `src/lib/supabase` | Browser, server, middleware, and privileged server client utilities. |
| `src/lib/env.client.ts`, `src/lib/env.server.ts` | Environment validation and client/server separation. |
| `supabase/migrations` | Versioned database schema and access controls. |
| `tests/milestone-2` | Mocked profile checks and disposable-database security rehearsals. |

## Trusted character import

The import action verifies the user through the cookie-based server client, accepts character identifiers from the form, and fetches the official profile on the server. It calls `save_verified_wow_character` with the verified user ID through the server-only privileged client.

Preserve that trust boundary: the browser must not supply trusted ownership or authoritative profile data. A privileged service-role write relies on server-verified ownership; it must not be described as protected by ordinary row-level security alone. Character and snapshot saves are atomic, and refresh preserves Main and sharing state as recorded in the Milestone 2 checkpoint.

## Access and privacy

- Keep privileged credentials and Blizzard credentials on the server.
- Preserve owner-only character controls and selected-Lodge visibility checks.
- A successful authentication check is not by itself permission to access another user's character.
- Preserve the security migration and regression coverage when extending character behavior.

For historical verification and its limits, read the [Milestone 2 checkpoint](milestone-2-checkpoint.md). For disposable database test instructions, use the [test README](../tests/milestone-2/README.md).
