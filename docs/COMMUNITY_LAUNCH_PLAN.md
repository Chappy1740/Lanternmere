# Lanternmere Community Launch Plan

## Purpose

Lanternmere is a community-first World of Warcraft hobby project. The goal of promotion is not to monetize the project. It is to help the right people discover it, invite friends and guildmates to try it, gather useful feedback, and grow awareness through genuine community participation.

The guiding principle is:

> We are not selling Lanternmere. We are inviting people into it.

## Positioning

Working positioning:

**Lanternmere — Your World of Warcraft home away from Azeroth.**

Lanternmere is an independently built hub, created by one player, where friends and guildmates can bring useful World of Warcraft information together in one place.

### Ownership and Stewardship

Lanternmere is not community-built. Its design, development, product direction, and stewardship remain with its creator. Community feedback is valuable input, not shared ownership or product governance.

> **Listen to the community. Do not outsource the vision to the community.**

Backend and administrative access remain intentionally restricted to the creator and, when needed, one or two specifically trusted people. Testers, guildmates, Discord members, and Founding Travelers do not receive backend access simply because they participate in the community.

Public descriptions must accurately reflect features that are actually available. Planned integrations or future capabilities should be labeled as planned until implemented.

## Official Community Channels

Lanternmere's current official public/community identities are:

- **Instagram:** `@Lanternmere_WoW`
- **X:** `@Lanternmere_WoW`
- **Discord:** Lanternmere

Keep the Lanternmere name, logo, voice, and visual identity consistent across these channels. Instagram and X are public-facing discovery and development-story channels; Discord remains the primary community space.

Public profiles should clearly describe Lanternmere as an independent/unofficial World of Warcraft community project and must not imply affiliation with or endorsement by Blizzard Entertainment.

## Audience

Initial audiences, in order:

1. Existing friends and guildmates.
2. Other trusted World of Warcraft players invited for early access.
3. Relevant WoW Discord communities.
4. Developers and hobby builders who discover Lanternmere through GitHub or Eydren.

Reddit is optional/future and is not part of the current active channel plan.

Growth quality matters more than raw user count.

## Stage 1 — Foundation

Build the reusable communication foundation while development continues.

Deliverables:

- Approved tagline and short description.
- Full About Lanternmere story.
- Community-first messaging guidelines.
- Basic visual and voice guidance.
- Clear relationship between Lanternmere and Eydren.
- A consistent way to describe current versus planned features.

Development remains the priority. Marketing work must not interrupt milestone implementation.

## Stage 2 — Capture

Capture finished parts of Lanternmere as they become presentation-ready rather than rebuilding launch material later.

Maintain a library of approved screenshots and short demonstrations, including where applicable:

- The Hearth.
- Travelers and character experiences.
- Quest Board.
- Integrations and external-data experiences.
- Desktop views.
- Phone and tablet views.
- Other major features as they become complete.

Screenshots must not expose credentials, private account information, private user data, or development secrets.

## Stage 3 — Early Access

Begin with a small group of real WoW players, primarily friends and guildmates.

Goals:

- Observe how people actually use Lanternmere.
- Identify confusing workflows.
- Find bugs before broader promotion.
- Learn which features players value.
- Collect actionable feedback.

Prepare:

- Discord announcement.
- Simple getting-started instructions.
- Feedback process.
- Known-issues guidance when necessary.
- Optional community identity for original testers, such as **Founding Travelers**. Founding Travelers are trusted early users and testers, not builders, owners, or product decision-makers.

## Stage 4 — Public Introduction

Broaden awareness only after Lanternmere is stable enough to represent the project well.

The Lanternmere Launch Kit should include:

- Short project description.
- Full project story.
- High-quality screenshots.
- 30–60 second demonstration.
- Discord-ready announcement.
- Polished GitHub README presentation.
- Banner and social graphics.
- Feature overview.
- FAQ.
- Feedback instructions.
- Clear Eydren attribution.

Promotion should emphasize showing useful features rather than advertising claims.

## Building in Public

Lanternmere's development journey can itself become useful community content.

Milestone updates may briefly show:

- What was built.
- Why it was added.
- A screenshot or short demonstration.
- What was learned.
- What is coming next when that information is appropriate to share.

These updates should remain authentic and occasional. Lanternmere should participate in communities rather than spam them.

## Eydren Relationship

Lanternmere is a showcase project built under the Eydren identity.

Recommended attribution:

**Built by Eydren**

Eydren attribution should remain secondary to Lanternmere in player-facing experiences. Lanternmere is the product/community identity; Eydren represents the builder and broader body of work.

## Success Measures

Because monetization is not the goal, success should focus on useful engagement:

- Friends and guildmates actively using Lanternmere.
- Repeat usage.
- Constructive feedback received.
- Bugs and usability issues discovered through real use.
- Organic referrals or invitations.
- Community conversations generated by project updates.
- Improvements made because of player feedback.

Avoid optimizing for follower counts or impressions at the expense of product quality.

## Guardrails

- Finish and stabilize features before broadly promoting them.
- Never describe planned functionality as already available.
- Do not expose private user or account information in promotional material.
- Follow each community's self-promotion rules.
- Avoid spam and repetitive cross-posting.
- Prefer real screenshots and demonstrations over exaggerated claims.
- Keep development milestones separate from community-launch work.
- Do not introduce marketing changes that compromise accessibility, security, maintainability, or application performance.


## Private Alpha — Break Lanternmere

Before broader public introduction, run a controlled Private Alpha with a small group of trusted friends and guildmates.

The goal is not simply to confirm that normal workflows work. Testers should intentionally explore unexpected behavior, confusing workflows, mobile use, repeated actions, refreshes, multiple tabs, unusual input, sign-out/sign-in transitions, and attempts to access or modify information they should not control.

Private Alpha readiness requires:

- A remotely accessible hosted test deployment; testers must not depend on the developer's local machine.
- Controlled account access appropriate to the current authentication architecture.
- Production-safe environment configuration with no secrets exposed to the browser or repository.
- Verified authentication and authorization behavior.
- Verified Supabase RLS boundaries for user-owned and shared data.
- Useful error and empty states.
- Responsive behavior on common phone and desktop sizes.
- A simple method for testers to report bugs, confusion, and suggestions.
- Clear identification of unfinished or beta functionality.

A tester report that a workflow is confusing should be treated as meaningful UX feedback even when the underlying code behaves as designed.

### Alpha Test Modes

Use two complementary test modes:

**Traveler Journey** — Ask a tester to begin with minimal instruction and complete normal tasks such as creating an account, finding their way around, working with their character information, using available community features, signing out, returning later, and confirming that expected data persists.

**Chaos Test** — Explicitly encourage testers to try unexpected sequences, strange but valid input, repeated clicks, refreshes, multiple tabs, mobile navigation, interrupted workflows, and unauthorized-access scenarios. Security testing must remain limited to Lanternmere accounts and data the tester is authorized to use.

## UX Label and Accessibility Audit

Before Private Alpha, perform a deliberate screen-by-screen labeling and accessibility audit.

Lanternmere may use immersive World of Warcraft-inspired terminology, but a new user should not need prior knowledge of the project to understand what an interface element does.

Guiding rule:

> Lanternmere can use thematic names, but users should never have to guess what something does.

For each screen, verify:

- The screen has a clear heading and purpose.
- Themed navigation names have supporting context when their meaning is not self-evident.
- Buttons use action-oriented, understandable text.
- Icon-only controls have accessible names and, where useful, visible tooltips.
- Form controls have persistent labels and do not rely on placeholder text as their only label.
- Destructive actions clearly state what will happen and use appropriate confirmation.
- Loading, success, error, empty, disabled, and unavailable states are understandable.
- Planned functionality is clearly marked as planned, unavailable, beta, or coming soon as appropriate.
- Status is not communicated by color alone.
- Keyboard navigation and visible focus behavior remain usable.
- Interactive targets remain understandable and usable on phone and tablet layouts.
- Accessibility names match the action a user expects.
- Error messages explain the problem and, when possible, the next action.

### Screen Review Workflow

Use the approved screen-capture set as the audit checklist:

**screen capture → label review → accessibility review → responsive review → Alpha ready**

Record issues as actionable development work rather than silently changing terminology during the audit. Shared navigation or design-system problems should be corrected at the shared-component level where practical instead of patched independently on every screen.

## Launch Readiness

A broader public introduction should wait until the current application is stable, representative screenshots are available, basic onboarding works, privacy/security concerns have been reviewed, and there is a simple way for early users to provide feedback.

Until then, community-launch work should remain lightweight documentation, asset capture, and preparation.
