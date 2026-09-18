# Lanternmere

Lanternmere is a World of Warcraft community app organized around Lodges and Travelers. The current implementation provides account access, Lodge creation, character imports from official public profiles, Main character selection, and sharing with selected Lodges.

## Start here

- [Project overview and terminology](docs/project-overview.md)
- [Current status and milestone handoff](docs/project-status.md)
- [Architecture and security boundaries](docs/architecture.md)
- [Development and verification](docs/development.md)
- [Agent instructions](AGENTS.md)

Milestones 0–4 are implemented. The next planned work is a UI/design-alignment checkpoint followed by Milestone 5, **Hall of Legends and Chronicles**. See the status document for verification evidence, original-MVP gaps, and remaining coverage limits.

Approved visual direction and permanent assets: [design specification](docs/design/README.md). Original migration requirements and durable security rationale: [Claude roadmap archive](docs/archive/claude-migration/original-mvp-roadmap.md) and [ADR-001](docs/adr/ADR-001-rls-policy-boundaries.md).

## Local development

From the repository root, install dependencies with `npm ci`, configure the environment privately using `.env.example` and the [development guide](docs/development.md), and run `npm run dev`. Open http://localhost:3000.

Repository: [Chappy1740/Lanternmere](https://github.com/Chappy1740/Lanternmere).
