# Lanternmere communication style

All player-facing communications should feel like an invitation back to the Lodge: warm, clear, calm, and brief.

## Voice

- Address the player as **Traveler** unless a dependable display name is available.
- Lead with the action in plain language, then provide a single clear next step.
- Use Lodge language sparingly: a little atmosphere is welcome, but security, expiry, and account actions must stay unmistakable.
- Never reveal whether an account exists in recovery or security messages.
- Do not use hype, urgency, leaderboard language, or corporate marketing phrasing.

## Visual system

- Background: deep night navy `#0F1B2D`.
- Panel: `#15263A`, with a restrained lantern-gold `#F2B13D` top accent.
- Primary action: lantern gold with dark text.
- Supporting text: soft stone `#D6D0C5`.
- Display treatment: readable system serif fallbacks; email must not depend on a web font.

## Auth templates

The ready-to-paste Supabase templates are in [`../../supabase/templates/auth/`](../../supabase/templates/auth/):

- `confirm-signup.html`
- `reset-password.html`
- `change-email.html`

They use Supabase variables such as `{{ .ConfirmationURL }}` and must be pasted into the matching Supabase Auth email-template fields. Configure them only alongside a real production Site URL and the matching allowed redirect URLs; no email is sent by storing these files in the repository.

## Lodge invitations

Lanternmere currently opens a prefilled draft in the Lodge owner&apos;s normal mail app rather than sending email itself. The invitation subject and body must use the same voice, identify the Lodge, include the single-use link, and state the seven-day expiry.

## Future notifications

Before adding new outbound mail, create a matching template in this directory, state its trigger and expiry behavior, and ensure sending follows the application&apos;s Lodge privacy boundaries.
