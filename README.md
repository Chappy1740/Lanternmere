# Lanternmere

Lanternmere is a World of Warcraft community app organized around Lodges and Travelers. The current implementation provides account access, Lodge creation, character imports from official public profiles, Main character selection, and sharing with selected Lodges.

## Start here

- [Project overview and terminology](docs/project-overview.md)
- [Current status and milestone handoff](docs/project-status.md)
- [Architecture and security boundaries](docs/architecture.md)
- [Development and verification](docs/development.md)
- [Agent instructions](AGENTS.md)

Milestones 0–3 are complete according to the project handoff. Milestone 3, **The Hearth**, provides personalized welcome, Lodge context, Main character, roster, and activity summaries. See the status document for verification evidence and remaining coverage limits.

## Local development

From the repository root, install dependencies with `npm ci`, configure the environment privately using `.env.example` and the [development guide](docs/development.md), and run `npm run dev`. Open http://localhost:3000.

Repository: [Chappy1740/Lanternmere](https://github.com/Chappy1740/Lanternmere).
