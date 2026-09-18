# Milestone 4 — Quest Board

## Status
Complete.

## Purpose
Build Lanternmere's Lodge event and activity system.

## Intended features
- Quest Board landing page
- upcoming Lodge events
- recent/past events where useful
- event creation
- event editing
- event detail pages
- event deletion/cancellation where supported
- attendance / RSVP
- participant lists
- Lodge-specific visibility
- role-based event management
- Hearth upcoming-event integration
- polished empty states

## Primary user flows
### View
Lodge member  
→ Quest Board  
→ Upcoming events  
→ Event details  
→ Participants / attendance

### Create
Authorized Lodge member  
→ Quest Board  
→ Create Event  
→ Enter details  
→ Validate  
→ Save  
→ Event appears on Quest Board

### Edit
Authorized Lodge member  
→ Open Event  
→ Edit  
→ Validate  
→ Save

### RSVP
Lodge member  
→ Open Event  
→ Choose attendance status  
→ Save  
→ Participant list updates

## Visibility and permission rules
- Private Lodge events are visible only to authorized Lodge members.
- Cross-Lodge access is prevented.
- Current implemented role rules are source-of-truth; do not infer capabilities only from role names.
- Event mutations are enforced server-side and through RLS.
- Hiding UI controls is not sufficient authorization.
- RSVP updates are limited by current event/profile/character ownership rules.

## Design intent
Quest Board should feel like a Lodge quest board rather than a corporate calendar. Preserve Lanternmere typography, colors, cards, spacing, shell, responsive patterns, and accessibility.

## Acceptance criteria
- Quest Board lists Lodge events correctly.
- Upcoming and past/recent event handling works.
- Authorized create/edit/delete works.
- Unauthorized mutations are blocked.
- Lodge boundaries are enforced.
- Event detail pages work.
- RSVP/attendance works.
- Participant lists work.
- Hearth integration works.
- Empty states work.
- Server-side validation exists.
- Error handling is safe and understandable.
- Responsive behavior is verified.
- Accessibility basics are verified.
- RLS/security remains intact.
- Lint, TypeScript, production build, regression checks, and whitespace validation pass.

## Milestone boundary
Milestone 4 owns event and attendance workflows; later milestones should reuse this canonical event data.

## Reconciliation note
The original roadmap also calls for participant role and character selection plus a group-composition summary. The current implementation supports RSVP and optional character association, but explicit role selection and group-composition presentation have not been verified as complete. Keep them recorded as remaining original-scope gaps rather than changing event behavior in this documentation pass.
