# Milestone 12 — The Expedition Board: Mythic+ Operations

## Status

Feature scope implemented October 3, 2026. The first release uses verified Guild group posts, member-chosen role interest, manual weekly goals, existing Guild key-night calendar entries, cached Raider.IO context only after explicit per-post sharing, and curated Supply Chest links. The migration is installed; synthetic rollback checks passed before and after installation. Real-account acceptance and independent audit remain open.

## Purpose

Help guild members organize Mythic+ activity using the roster and progress data Lanternmere already knows.

## Planned scope

- Mythic+ group posts with desired key range, time, roles, and notes.
- Matching views for guild members with relevant roles/characters.
- Weekly Mythic+ goals and Vault progress.
- Raider.IO-backed cached context where consented and supported.
- Guild key-night planning and event integration.
- Dungeon/route/resource links through the Supply Chest.

## Guardrails

- Matching is informational; players choose their own groups.
- Do not infer availability from online status unless explicitly supported and consented.
- Respect Raider.IO attribution, freshness, and rate limits.

## First-release choices

- Any verified Guild member may propose a future dungeon/key-range plan and requested roles. Members express interest with a Traveler they control. The organizer chooses the actual party; Lanternmere does not accept or assign members automatically.
- The organizer or verified Guild leadership may close a post to new interest or remove it and its interests. Closing is not an automatic cancellation or party assignment.
- A member may optionally attach the last saved Raider.IO Mythic+ score to one interest record. This copies the score, source URL, and refresh time; it does not make a new Raider.IO request. Updating without the checkbox clears the shared copy. Removing interest or leaving the Guild removes it. A stale score remains labeled by its saved time.
- Each member may keep a manual runs/key-level goal for a reset date. It stays private until the member explicitly shares it with their verified Guild. The Guild board does not expose private War Table Vault notes.
- Existing Guild calendar entries in the Mythic+ category provide key-night context. Leaders maintain those entries in the War Table; a board post does not silently create a canonical event or calendar entry.
- The Supply Chest offers source-attributed links to Blizzard's season announcement and external route/progress publishers. These links can change and are not treated as verified group instructions.
- A daily retention job deletes group posts and their interests 30 days after the planned start, and weekly goals 90 days after their reset date. Members can also remove interest directly.
