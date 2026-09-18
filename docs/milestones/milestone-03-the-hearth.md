# Milestone 3 — The Hearth

## Status
Complete.

## Purpose
Turn The Hearth into Lanternmere's central authenticated Lodge dashboard.

## Product intent
The Hearth should feel like arriving home, not like a generic admin dashboard.

It should quickly answer:
- Who am I?
- Which Lodge am I in?
- What character am I playing?
- Who is here with me?
- What is coming up?
- What recently happened?
- Is my imported WoW data current?

## Intended features
- personalized welcome
- explicit Lodge context
- main character highlight
- Lodge roster summary
- upcoming event summary
- recent achievements summary
- recent Chronicle summary
- character freshness/status indicators
- useful empty states
- partial-failure handling
- responsive and accessible layout

## User flows
### Enter Hearth
Authenticated Lodge member  
→ Open The Hearth  
→ See Lodge context, welcome, main character, roster, and activity summaries

### Switch Lodge context
Multi-Lodge member  
→ Select available Lodge context  
→ Hearth summaries update for that Lodge

## Visibility and permission rules
- Authentication and Lodge membership remain required.
- Lodge summaries are scoped to a verified Lodge membership.
- Shared character content respects existing character-sharing rules.
- RLS remains the final data boundary.

## Acceptance criteria
- Personalized welcome works.
- Lodge context is clear.
- Main character highlight works.
- No-main-character state works.
- Lodge roster summary works.
- Available event, achievement, and Chronicle summaries render correctly.
- Empty and partial-failure states work.
- Freshness/status indicators work where supported.
- Responsive behavior is verified.
- Accessibility basics are verified.
- Lint passes.
- Production build passes.
- Regression checks pass.

## Milestone boundary
Milestone 3 surfaces later-system data but does not own full event management, Hall of Legends, or Chronicle authoring.
