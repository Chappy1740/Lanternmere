# Milestone 5 — Hall of Legends and Chronicles

## Status
Next / not started.

## Purpose
Preserve accomplishments, memorable moments, and the shared history of each Lodge.

# Hall of Legends

## Intended features
- display meaningful character and Lodge accomplishments
- surface World of Warcraft achievements where available
- support Lanternmere-created accomplishments if the current schema supports them
- show related character, Lodge, and event context where supported
- distinguish Blizzard-derived achievement data from Lanternmere-created accomplishments
- provide clear empty states

## Primary user flow
Lodge member  
→ Open Hall of Legends  
→ Browse accomplishments  
→ Open an accomplishment  
→ See related character/Lodge/event context where supported

# Chronicles

## Intended features
- Lodge history and stories
- Chronicle listing
- Chronicle detail view
- create/edit/delete flows if supported and approved
- relationships to Lodge, profile, character, event, or accomplishment where supported
- chronological presentation where useful
- recent Chronicle activity surfaced on The Hearth
- clear empty states

## Primary user flows
### Browse
Lodge member  
→ Open Chronicles  
→ Browse Lodge history  
→ Open Chronicle entry  
→ Read story and related context

### Create, if supported
Authorized Lodge member  
→ Create Chronicle entry  
→ Enter story/details  
→ Validate  
→ Save  
→ Entry appears in Chronicles  
→ Recent entry may surface on The Hearth

### Edit/delete, if supported
Authorized user  
→ Open Chronicle  
→ Edit or delete  
→ Validate permission  
→ Save

## Visibility and permission rules
Before implementing exact permissions, inspect current tables, migrations, helper functions, RLS, and role rules.

Security requirements:
- Lodge-private content remains Lodge-private.
- Cross-Lodge access is prevented.
- RLS remains the final database boundary.
- UI visibility is not authorization.
- Mutations require server-side checks.
- Users cannot edit/delete records they do not control.
- Do not use service-role access to bypass proper authorization.

## Design intent
Hall of Legends should feel celebratory, meaningful, warm, and personal.

Chronicles should feel like the Lodge's shared history: readable, atmospheric, personal, and lasting.

Avoid leaderboard-heavy presentation, corporate dashboards, generic social feeds, and unnecessary analytics.

Preserve Lanternmere's established visual system and accessibility standards.

## Hearth integration
Where supported, The Hearth may show:
- recent accomplishments
- recent Hall of Legends activity
- recent Chronicle entries

Use canonical Hall of Legends / Chronicle data rather than duplicate dashboard-only records.

## Acceptance criteria
### Hall of Legends
- accomplishment/achievement information displays correctly
- Blizzard-derived vs Lanternmere-created data is distinguishable
- supported relationships work
- Lodge boundaries are enforced
- empty states work

### Chronicles
- Chronicle listing works
- Chronicle detail view works
- supported create/edit/delete behavior works
- unauthorized changes are blocked
- supported relationships work
- Lodge privacy is enforced
- empty states work

### Integration and quality
- recent relevant activity surfaces on The Hearth
- canonical data is reused
- responsive behavior is verified
- accessibility basics are verified
- server-side validation exists for mutations
- safe error handling exists
- RLS/security remains intact
- lint passes
- TypeScript passes
- production build passes
- relevant regression tests pass
- git diff --check passes
- final diff is reviewed

## Milestone boundary
Milestone 5 completes the initial Lanternmere MVP roadmap. After completion, perform a full Milestones 0–5 integration review.

## Usage-saving and model guidance
- Use repository docs as project memory instead of restating the full roadmap each session.
- Prefer targeted inspection over rereading the entire repo.
- Use the smallest capable model for each task.
- Default normal implementation work to Terra Medium.
- Use Terra Light for tiny edits and simple docs/style changes.
- Use Sol Medium for multi-file architecture, difficult RLS/security work, or complex cross-feature integration.
- Use Astra Light for focused inspection/review or a narrow difficult bug.
- Use Astra Medium only for hard debugging, subtle security issues, or problems that resisted lower levels.
- Start a new focused Codex chat when a feature area changes substantially or context becomes cluttered.
