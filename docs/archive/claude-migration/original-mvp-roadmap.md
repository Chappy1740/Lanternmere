# Original Claude MVP roadmap — archived requirements record

This durable requirements record was recovered during the Claude-to-repository migration. It preserves original scope that later milestone specifications had weakened or omitted. It is historical product direction, not evidence that every item is implemented.

## Original MVP journey

A new user can create a private Lodge, invite a friend, import a character, see it on The Hearth, schedule an event, and RSVP.

## Reconciliation requirements

- **Milestone 1:** secure Lodge invitations and Lodge role management are original requirements. The repository has owner membership creation and role-aware policies, but no secure invite workflow or role-management UI. These remain MVP gaps.
- **Milestone 4:** events must support participant role and character selection plus a group-composition summary. RSVP and optional character association exist; explicit role selection and a group-composition summary have not been verified and remain gaps until proven or implemented.
- **Milestone 5:** include group milestones, screenshots/media references and captions for memories, character and Lodge achievements, and search/filtering for shared memories. The initial schema has \`chronicle_entries.image_url\`, but upload/media storage, captions, and memory search/filtering are not currently implemented.

## Migration-package housekeeping

\`Lanternmere_Architecture.md\` duplicated roadmap material, \`Lanternmere_Brand_Guide.md\` duplicated small project metadata, and the original README and master prompt overlapped. Preserve the requirements through this archive and current documentation rather than recreating misleading duplicate filenames.
