# Milestone 1 — The Front Door

## Status
Complete.

## Purpose
Provide the secure entry path into Lanternmere and establish a user's first Lodge.

## Intended features
- account registration
- email confirmation
- sign in and sign out
- protected authenticated routes
- automatic profile creation
- Lodge creation
- Lodge owner membership
- Lodge membership routing
- protected Hearth access

## Primary user flow
Create Account  
→ Confirm Email  
→ Sign In  
→ Protected Application  
→ Create Lodge  
→ Become Lodge Owner  
→ Enter The Hearth

## Visibility and permission rules
- Signed-out users cannot access protected application areas.
- Signed-in users without Lodge membership are routed to Lodge onboarding.
- Lodge-required routes verify membership server-side.
- Database RLS remains enabled.
- UI visibility is not authorization.

## Acceptance criteria
- Registration works.
- Email confirmation works.
- Sign in and sign out work.
- Profile creation works.
- Protected routes work.
- Lodge creation works.
- Lodge creator becomes owner.
- Lodge membership routing works.
- Hearth access is protected.
- Lint passes.
- Production build passes.

## Milestone boundary
Authentication and Lodge membership remain separate gates so onboarding routes can remain reachable.
