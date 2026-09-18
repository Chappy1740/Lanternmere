# Project overview

## Purpose and terminology

Lanternmere uses a fantasy Lodge theme for a World of Warcraft community application. This description reflects the current repository, not a complete future product specification.

| Term          | Current meaning                                                                          |
| ------------- | ---------------------------------------------------------------------------------------- |
| Lodge         | A community with membership; users can create a Lodge during onboarding.                 |
| Travelers     | The character area, with imports, cards, details, and character controls.                |
| Main          | A user's selected main character, with switching supported.                              |
| The Hearth    | The authenticated Lodge dashboard with context, Main character, roster, and activity summaries. |
| Lodge sharing | Owner-controlled character visibility in selected Lodges.                                |

## Implemented capabilities

- Sign-up, sign-in, authenticated application shell, and Lodge onboarding.
- WoW character lookup by region, realm, and name using official public profile data fetched on the server.
- Character and snapshot persistence, refresh, Main selection, and selected-Lodge sharing.
- Theme tokens and a shared sidebar/topbar shell.
- The Hearth dashboard and Quest Board event/RSVP workflows.

Hall of Legends and Chronicles are the next product area. Navigation labels do not establish implementation on their own.

## Boundaries of this documentation

The repository, milestone specifications, and preserved checkpoints are evidence for implemented behavior. The original migration roadmap is archived separately to retain requirements that still remain gaps. Do not infer implementation from navigation labels.
