# Milestone 11 — The Artisan Hall: Professions & Guild Services

## Status

Feature scope implemented October 3, 2026. The first release uses member-entered crafting capabilities and requests. The linked migration is installed; live acceptance under A-12 and independent Claude Code audit remain open.

## Purpose

Make the guild roster useful outside raids by connecting members to crafting, professions, resources, and requests.

## Planned scope

- Character professions, specialization, notable recipes, and crafting capability.
- "Who can craft this?" discovery.
- Guild crafting requests and completion status.
- Optional manually maintained guild resource/supply goals.
- Consumable or material requests where supported.
- Links back to character ownership and guild permissions.

## Guardrails

- Do not claim live guild-bank visibility unless a supported Blizzard integration provides it.
- Distinguish imported facts from player-entered capabilities and inventory.
- Avoid turning the feature into a financial marketplace.

## First-release choices

- Verified Guild members explicitly publish capabilities for Travelers they control. Profession, specialization, notable recipe, and service details are player-entered claims, not Blizzard-verified recipe ownership or live inventory.
- Other members of that same verified Guild can search posted recipes and professions. Removing a capability or leaving the Guild removes its Guild listing.
- Members can request a crafted item, consumable, or material and volunteer to fulfill an open request. The requester, volunteer, or verified Guild leadership can record completion as a human update. No payment, order processing, or automatic inventory accounting is included.
- A request shares the requester's opted-in game nickname with verified Guild members; volunteering shares the volunteer's nickname. The requester can remove their request. Leaving the Guild removes that member's capabilities and requests and releases their unfinished volunteer commitments.
- Verified Guild Masters and Officers can optionally maintain supply goals and manually entered progress. This is a planning note, not a view of the Guild bank.
- The data model and database rules must keep each Guild separate, protect character ownership, and avoid exposing account or character information through unrelated Lodge sharing.
