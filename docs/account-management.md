# Account management and Battle.net onboarding

Accepted changes CR-007–CR-009 are app-wide additions, separate from Guild/Lodge roles.

## Member flow

- Signup requires a game nickname of 2–32 characters; email addresses and control characters are rejected. Optional sharing with the application owner is unchecked by default.
- Confirmation leads to `/account`. Existing members can open **Your account** to set their game nickname. Changing it does not alter directory sharing.
- Members choose a region and authorize their own Battle.net account. The existing registered OAuth callback dispatches personal character connections independently of Guild Master claims.
- State is random, expires after ten minutes, and is bound to the signed-in Lanternmere account. The server fetches Blizzard's available account characters; tokens are not persisted. Only the member can read their snapshot. Refresh requires renewed authorization. The chosen region's API availability limits the list; the app does not promise every historical/Classic character.
- This is a personal character list, not automatic character imports, Guild membership, leadership, or consent to share game data.

## Owner flow

- Only the verified account matching the production `APP_OWNER_PROFILE_ID` can open `/owner/accounts` or invoke its access action. Membership links to it only for that owner.
- Registered accounts, accounts seen in the last seven days, and suspended accounts are separate counts. Activity starts when this feature is enabled; each authenticated server verification records activity at most once every five minutes. It is not concurrent-user analytics.
- The owner management page identifies accounts by sign-in email, as explicitly requested by the app owner. A service-only bounded projection reads only user IDs and emails, never password hashes, tokens, metadata, or game snapshots. Ordinary members cannot call this projection. Signup and Membership explain this access. Nicknames remain opt-in and hidden aliases stay hidden; Membership's registration directory still uses pseudonyms for those aliases.
- A confirmation checkbox precedes suspension/restoration. The owner cannot suspend their own account. No permanent deletion is provided. Changes are audited atomically through a service-only RPC.

## Access enforcement

- The server auth client checks application access before returning a verified user. Suspension leaves the account/data intact but denies subsequent authenticated application requests; restoration restores access.
- A caller-permission PostgREST pre-request hook denies suspended accounts before table/RPC requests, including security-definer RPCs, using the current database flag rather than stale JWT metadata. Anonymous and service requests skip this account check.
- Restrictive policies cover current public RLS tables and Storage objects for authenticated users. Future migrations must add this policy to newly exposed RLS tables. Private snapshots are readable only by their owner.
- Public assets stay public. Previously issued signed download URLs remain usable until their expiry; suspension does not revoke those capabilities or abort requests already in flight.
- The migration stops rather than overwriting an existing PostgREST pre-request hook. Review and compose any future hook changes with account enforcement.

## Verification

Run `node tests/security/check-account-management.cjs` and the existing `check-app-membership.cjs`. The former covers signup validation/consent, owner-only actions, owner self-protection, required confirmation, restoration, and personal OAuth wrong-user/state/expiry boundaries.

For rollback-only database rehearsal, concatenate `BEGIN;`, the account-access migration, `tests/security/account-access-assertions.sql`, and `ROLLBACK;` into one SQL file. It uses two existing profiles without exposing identities and rolls back every schema/data/configuration change. Never apply the historical Milestone 2 disposable baseline to the original database.

Live acceptance still requires fresh signup/confirmation, real member Battle.net authorization, a second account for owner-directory visibility and suspension/restoration, and a stale-token HTTP check. Automated SQL/action tests do not substitute for those hosted checks.
