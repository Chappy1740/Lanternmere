# Lanternmere

Lanternmere is a World of Warcraft community app organized around Lodges and Travelers. The current implementation provides account access, Lodge creation, character imports from official public profiles, Main character selection, and sharing with selected Lodges.

## Start here

- [Project overview and terminology](docs/project-overview.md)
- [Current status and milestone handoff](docs/project-status.md)
- [Public status dashboard and tracking rules](docs/project-tracker.md)
- [Architecture and security boundaries](docs/architecture.md)
- [Development and verification](docs/development.md)
- [Cloudflare Workers preview hosting](docs/cloudflare-hosting.md)
- [Agent instructions](AGENTS.md)

Milestones 0–10 have their feature scope implemented. Milestone 7, **The Guild Hall: Guild Operations**, delivers the Guild foundation, consented readiness, canonical-event operations, attendance, and settings. Milestone 8, **The Raid Room**, adds raid operations and human-directed Loot Council workflows. Milestone 9, **The War Table**, adds weekly priorities, Guild plans, reset-aware Vault notes, availability, leadership follow-ups, and private calendar exports. Milestone 10, **The Muster**, adds private Guild recruitment applications and human-led trials. Guild leadership still requires a Battle.net-verified rank-0 claim; live claim and multi-account security acceptance remain open. Warcraft Logs integration is deferred to Milestone 13, **The Chronicle Lens: Progression Intelligence**, where it can use a supported OAuth/client-credential path. See the [product roadmap](docs/milestones/ROADMAP.md), [Milestone 10 specification](docs/milestones/milestone-10-recruitment.md), and status document for verification evidence and remaining coverage limits.

Approved visual direction and permanent assets: [design specification](docs/design/README.md). Original migration requirements and durable security rationale: [Claude roadmap archive](docs/archive/claude-migration/original-mvp-roadmap.md) and [ADR-001](docs/adr/ADR-001-rls-policy-boundaries.md).

## Local development

From the repository root, install dependencies with `npm ci`, configure the environment privately using `.env.example` and the [development guide](docs/development.md), and run `npm run dev`. Open http://localhost:3000.

Repository: [Chappy1740/Lanternmere](https://github.com/Chappy1740/Lanternmere).
