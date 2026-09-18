# Milestone 2 — Travelers and Characters

## Status
Complete.

## Purpose
Connect Lanternmere users with their World of Warcraft characters.

## Intended features
- add a character by region, realm, and character name
- normalize and validate identifiers
- secure server-side Blizzard/Battle.net integration
- normalized character storage
- character snapshots where supported
- main/alternate designation
- Lodge character sharing
- character cards
- character detail pages
- source and refresh timestamps
- graceful handling of missing/private profiles, throttling, and integration failures

## Primary user flows
### Add character
Traveler  
→ Add Character  
→ Enter region, realm, and character name  
→ Validate  
→ Retrieve official public WoW data  
→ Save character and snapshot  
→ View character

### Main/alternate
Traveler  
→ Open character  
→ Mark Main or Alternate  
→ Save

### Lodge sharing
Traveler  
→ Open character sharing  
→ Select Lodges  
→ Save sharing choices

## Visibility and permission rules
- Blizzard credentials remain server-side.
- Public WoW data does not make Lanternmere ownership/sharing public.
- Character access respects ownership, Lodge sharing, and RLS.
- Cross-user and cross-Lodge access must remain constrained by current policies.

## Acceptance criteria
- Character import works.
- Blizzard secrets remain server-side.
- Normalized storage works.
- Ownership works.
- Main/alternate designation works.
- Lodge sharing works.
- Character cards and detail pages work.
- Source/refresh information is visible.
- Important integration failures are handled safely.
- Lint passes.
- Production build passes.
- Regression checks pass.

## Milestone boundary
Later milestones should reuse this character data rather than duplicate it.
