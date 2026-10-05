# Lanternmere

Lanternmere is a World of Warcraft community app organized around Lodges and Travelers. The personal Hearth opens after sign-in, before joining a Lodge. New Travelers come from the member's connected Battle.net character list and use official public profiles for character details. The first Traveler becomes Main; Lodge sharing is optional. Earlier public-name imports remain saved and are labeled unverified.

## Start here

- [Project overview and terminology](docs/project-overview.md)
- [Current status and milestone handoff](docs/project-status.md)
- [Public status dashboard and tracking rules](docs/project-tracker.md)
- [Architecture and security boundaries](docs/architecture.md)
- [Development and verification](docs/development.md)
- [Cloudflare Workers preview hosting](docs/cloudflare-hosting.md)
- [Agent instructions](AGENTS.md)

Milestones 0–14 have their feature scope implemented. Milestone 7, **The Guild Hall**, delivers the Guild foundation and consented readiness. Milestone 8, **The Raid Room**, adds raid operations and human-directed Loot Council workflows. Milestone 9, **The War Table**, adds weekly priorities and private calendar exports. Milestone 10, **The Muster**, adds private Guild recruitment and trials. Milestone 11, **The Artisan Hall**, adds member-entered crafting and Guild requests. Milestone 12, **The Expedition Board**, adds Guild Mythic+ posts and weekly goals. Milestone 13, **The Chronicle Lens**, adds owner-only Raider.IO history and public Warcraft Logs report lookup. Milestone 14, **The Lanternkeeper**, adds verified-leadership briefings and optional aggregate-only AI wording. Guild leadership still requires a Battle.net-verified rank-0 claim; live claim and multi-account acceptance remain open. See the [product roadmap](docs/milestones/ROADMAP.md), [Milestone 14 specification](docs/milestones/milestone-14-lanternkeeper.md), and status document for verification evidence and remaining gaps.

Approved visual direction and permanent assets: [design specification](docs/design/README.md). Original migration requirements and durable security rationale: [Claude roadmap archive](docs/archive/claude-migration/original-mvp-roadmap.md) and [ADR-001](docs/adr/ADR-001-rls-policy-boundaries.md).

## Local development

From the repository root, install dependencies with `npm ci`, configure the environment privately using `.env.example` and the [development guide](docs/development.md), and run `npm run dev`. Open http://localhost:3000.

Repository: [Chappy1740/Lanternmere](https://github.com/Chappy1740/Lanternmere).
