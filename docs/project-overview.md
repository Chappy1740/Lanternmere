# Project overview

## Purpose and terminology

Lanternmere uses a fantasy Lodge theme for a World of Warcraft community application. This description reflects the current repository, not a complete future product specification.

| Term          | Current meaning                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Lodge         | A community with membership; users can create a Lodge during onboarding.                        |
| Travelers     | The character area, with imports, cards, details, and character controls.                       |
| Main          | A user's selected main character, with switching supported.                                     |
| The Hearth    | The authenticated Lodge dashboard with context, Main character, roster, and activity summaries. |
| Lodge sharing | Owner-controlled character visibility in selected Lodges.                                       |

## Implemented capabilities

- Sign-up, sign-in, authenticated application shell, and Lodge onboarding.
- WoW character lookup by region, realm, and name using official public profile data fetched on the server.
- Character and snapshot persistence, refresh, Main selection, and selected-Lodge sharing.
- Theme tokens and a shared sidebar/topbar shell.
- The Hearth dashboard, Quest Board event/RSVP workflows, Hall of Legends, Chronicles, the Adventures planning hub, Guild Hall operations, Raid Room, War Table, Muster, Artisan Hall, Expedition Board, Chronicle Lens, and Supply Chest.

Milestones 0–14 have implemented feature scope. Milestone 15 is in progress locally for private problem reports and ideas. Milestone 6 provides Lodge-scoped planning, recurring plans, campaigns, canonical Quest Board preparation notes, opt-in Raider.IO snapshots, and player-submitted Raidbots handoffs. Milestone 7 delivers Guild Hall operations, Milestone 8 delivers Raid Room operations, Milestone 9 adds the War Table weekly command center, Milestone 10 adds private recruitment and trials, Milestone 11 adds member-entered crafting discovery and Guild service requests, Milestone 12 adds verified Guild Mythic+ group posts and weekly goals, Milestone 13 adds owner-only Raider.IO history and public Warcraft Logs lookup, and Milestone 14 adds verified-leadership Guild briefings with optional aggregate-only AI wording. Independent audits and live acceptance remain separate. See `docs/milestones/ROADMAP.md`. Navigation labels do not establish implementation on their own.

## Boundaries of this documentation

The repository, milestone specifications, and preserved checkpoints are evidence for implemented behavior. The original migration roadmap is archived separately to retain requirements that still remain gaps. Do not infer implementation from navigation labels.
