# Data sources and inspiration

Lanternmere credits its data sources separately from its design references. A credit does not establish permission to reuse an asset or change an API's allowed uses. Integration review must cover the provider's published terms, access requirements, attribution, privacy, caching, and limits before connecting new data. If intended use is unclear, prepare an inquiry for Will to review before contacting the provider.

## Personal Hearth

| Provider                                                                                         | Use                                                                                            | Current boundary                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Blizzard / Battle.net](https://develop.battle.net/documentation/world-of-warcraft/profile-apis) | Official public character snapshots; private account-list proof establishes Traveler ownership | Existing integration. Imported data is attributed; account-list proof stays private.                                                                                              |
| [Raider.IO](https://raider.io/api)                                                               | Saved Main score and progression snapshots                                                     | Existing integration. History retains its source and saved date; scores are not dungeon counts.                                                                                   |
| [WoWAudit](https://wowaudit.com/)                                                                | Inspiration for compact character, gear, progression, and equipment organization               | Lanternmere implements its own components and styling. No WoWAudit code, branding, screenshots, or API data are imported into the Hearth. Visible inspiration credit is included. |

## WoWAudit API follow-up

Will does not currently administer a WoWAudit team and chose to build the Hearth first. The [documented API](https://wowaudit.com/api) requires a team's administrative access and key. A future connection must have a separately reviewed scope, provider terms/access review, server-only credentials, and explicit sharing boundaries. Team access must never replace Battle.net ownership proof or grant another Lanternmere account access to private team data.

The published schema includes recorded activity/vault data, best gear, and wishlists. It does not establish that every field on the public character dashboard is available through the API. Confirm actual supported fields, freshness, and limits before promising an integration. No team key was requested, no provider was contacted, and no API connection was made in this layout patch.

Other integrations retain their existing source labels and contracts. Apply this review and credit rule to each new provider or reused asset; record outreach and approval evidence before claiming endorsement or permission.

### Raid achievement dates

The Hearth's AOTC/CE milestones use completion dates returned by Blizzard's character achievements endpoint. They do not use encounter `last_kill_timestamp` as a first-kill date. [Blizzard's explanation of achievement completion](https://us.forums.blizzard.com/en/blizzard/t/character-achievements-api-when-is-an-achievement-completed/7171) describes account-wide versus character completion and privacy settings. The UI labels that limitation and never infers a first character kill from an achievement date.
