# Project overview

## Purpose and terminology

Lanternmere uses a fantasy Lodge theme for a World of Warcraft community application. This description reflects the current repository, not a complete future product specification.

| Term          | Current meaning                                                                          |
| ------------- | ---------------------------------------------------------------------------------------- |
| Lodge         | A community with membership; users can create a Lodge during onboarding.                 |
| Travelers     | The character area, with imports, cards, details, and character controls.                |
| Main          | A user's selected main character, with switching supported.                              |
| The Hearth    | The dashboard route; currently a placeholder behind account and Lodge membership checks. |
| Lodge sharing | Owner-controlled character visibility in selected Lodges.                                |

## Implemented capabilities

- Sign-up, sign-in, authenticated application shell, and Lodge onboarding.
- WoW character lookup by region, realm, and name using official public profile data fetched on the server.
- Character and snapshot persistence, refresh, Main selection, and selected-Lodge sharing.
- Theme tokens and a shared sidebar/topbar shell.

Navigation also names Adventures, Quest Board, Hall of Legends, Chronicles, Supply Chest, and Caretaker's Office. Navigation labels do not establish implemented features or approved milestone scope.

## Boundaries of this documentation

The repository and preserved Milestone 2 checkpoint are the evidence for implemented behavior. The user's handoff establishes milestone completion and the next milestone's name. Detailed future requirements, including The Hearth's contents, still need to be provided. Do not invent a roadmap from labels or placeholders.
