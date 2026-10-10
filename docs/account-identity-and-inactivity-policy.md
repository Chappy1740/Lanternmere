# Owner account identity and inactivity policy

Accepted direction from Will on October 5, 2026. The implementation and linked acknowledgment migration were prepared and verified on October 10; live multi-account acceptance remains open. See `project-status.md` for release evidence.

## Owner-visible account identity

- Use the member's selected, Battle.net-verified Main's character name, realm, and region as the account label in both owner membership and account-management views.
- Remove sign-in emails from owner queries and rendered pages. Email remains necessary for authentication; hiding it in administration does not remove it from the authentication service.
- Make the Main identity requirement clear before a member completes Main onboarding. Sharing this limited identity with the app owner is required under the new policy. It does not authorize publishing alternate characters, equipment, private notes, the Battle.net character list, or Guild/Lodge information to the owner or other members.
- Existing users must acknowledge the changed policy before previously withheld character names are exposed. A prior optional nickname opt-in is not acknowledgment of this new Main identity requirement.
- Until a verified Main and policy acknowledgment exist, show an account reference and an onboarding-incomplete label. Never infer a label from an email, hidden nickname, or unverified public import.
- Read verified identity from the server's character claim records. Client metadata or a supplied profile ID cannot establish ownership. Changing Main updates the label only when the new selection satisfies that proof and acknowledgment rule.
- Retain the configured server-side app-owner gate. Ordinary members cannot enumerate account identities or activity.

## Thirty-day inactivity

Will chose automatic restoration when the member signs in again.

- Measure inactivity using the last verified app visit, which the existing activity recorder already tracks. A member who remains signed in and keeps using the app must not be treated as inactive.
- After 30 days without verified activity, show the account as dormant. A returning member's verified activity makes it active again automatically. The state can be derived from timestamps; a destructive cleanup job is unnecessary.
- Keep inactivity dormancy distinct from an owner-imposed suspension. Automatic restoration must never bypass a manual suspension or the existing database access checks.
- For accounts with no recorded visit, display that absence honestly. Signup time can determine age, but must not be described as a successful visit or login.
- Preserve account data and character claims. Dormancy does not free storage or reduce the number of stored authentication accounts. Storage reclamation would need a separately defined deletion and retention policy; 30-day automatic deletion is outside this change.

## Implementation and acceptance

Prepare the smallest acknowledgment schema and a bounded server-only identity projection, update onboarding disclosures and both owner views, and retire email rendering. Reuse the activity recorder for dormancy rather than modifying manual suspension enforcement.

Verify owner/non-owner isolation, no email or alternate-character leakage, acknowledgment before exposure of existing private identities, verified-Main selection and changes, the exact 30-day boundary, return-to-active behavior, unknown activity, and preservation of manual suspensions. Rehearse any migration inside a rollback transaction before installation. Keep real-account acceptance separate from synthetic checks.

The October 5 test of the former optional alias flow succeeded: Will hid his alias, refreshed, and confirmed it was removed from the owner list. This is historical evidence for that revocation path, not acceptance of the new Main identity policy or non-owner isolation.
