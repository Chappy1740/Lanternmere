# Milestone 10 — The Muster: Recruitment & Trials

## Status

Feature scope implemented on October 3, 2026. The database migration is installed; live multi-account acceptance remains open under A-11.

## Purpose

Give guild leadership a structured recruitment and trial workflow without turning people into opaque scores.

## Planned scope

- Recruitment needs by role/class/spec as leader-maintained needs.
- Applicant intake and application status.
- Applicant -> Trial -> Raider/Member workflow.
- Availability, experience, character links, supported log/profile links, and officer notes.
- Trial start/end dates, trial attendance context, review notes, and decision history.
- Permissions for recruiters, officers, and guild administrators.
- Privacy, retention, deletion, and audit behavior for applicant data.

## Guardrails

- No automatic accept/reject decisions.
- External rankings or logs are context, not universal requirements.
- Sensitive officer notes require explicit access controls and retention rules.

## Implementation choices

- A signed-in nonmember can open a Guild's recruitment link when that Guild has a current verified claim and at least one active need. The board shows only the Guild name and posted needs. A Guild membership is not required to apply.
- An application explicitly shares the applicant's display name, self-reported availability and experience, optional linked Traveler, and optional HTTPS profile/log links with that Guild's verified recruiting team. Links are context supplied by the applicant, never an automatic score or verified ownership claim. Sign-in email is not copied into recruitment records.
- Recruiters can maintain needs, review applications, start trials, and add private notes. Officers and the verified Guild Master can also record final accepted/declined decisions, each with a private reason. Acceptance records a human decision; a Guild invitation is a separate Guild Hall action.
- Applicants see their own application status and can delete their application with its private review data. Only the verified recruiting team sees officer notes and decision history. Deletion leaves only a content-free Guild audit event. Active applications expire after 180 days; accepted or declined applications expire 90 days after the decision. A daily database job deletes expired applications and their dependent notes/history.
- Trial dates and attendance context are explicitly entered by leadership. They do not imply a Quest Board RSVP or an official Blizzard attendance record.

## Acceptance still needed

- A second account must verify applicant-only reads, recruiter-only notes, Officer/Master decisions, cross-Guild denial, application deletion, and the hosted retention job after the migration is installed. Synthetic rollback checks are useful evidence but do not replace this live acceptance.
