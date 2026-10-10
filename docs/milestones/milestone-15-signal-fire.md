# Milestone 15 — The Signal Fire: Problems and Ideas

## Status

Accepted and planned October 10, 2026. No submission form, inbox, reply thread, database table, or notification has been implemented or published. Live acceptance is tracked as A-18.

## Purpose

Give a signed-in member a simple way to tell Lanternmere that something is broken or suggest an improvement. The report goes to the application owner for review and a private reply, not to a Lodge or a public board.

## First release

- Provide a clearly labeled **Report a problem or share an idea** entry point for signed-in members, including on a phone. It must not require creating a Lodge or a Traveler. A signed-out visitor is directed to sign in before submitting.
- Let the sender choose **Something is broken** or **Idea or request**, then describe it in plain text. A problem report may include an optional page or feature name and steps to reproduce. Ask for the minimum information needed; do not require game characters, email, or screenshots.
- Confirm that Lanternmere received the submission, and show a clear error with the entered text preserved when delivery fails. Do not promise a reply time or a fix date.
- Give the application owner a private inbox with simple states such as New, Reviewing, Planned, and Closed. The sender can see their own submission, its state, and its private conversation with the owner. No member can read another person's report. A state is a triage label, not a promise of implementation.
- Let the owner reply to the sender inside the report, and let the sender answer in the same private thread. Show new replies when either party next opens Lanternmere. Email alerts are outside the first release.
- Keep reports out of public status, search, Lodge, Guild, and AI surfaces. An owner may separately turn an idea into a public, sanitized project request after review; the original text must not be published automatically.

## Privacy and abuse boundaries

- Store submissions and replies with access rules enforced on the server and in database policies. The owner can read, reply, and triage; the signed-in sender can read and answer only their own thread. Other members and Lodge leaders cannot read or alter them through direct links or APIs.
- Do not include passwords, login codes, private Battle.net lists, or sensitive account details in a report. Show this reminder beside the form and avoid collecting them in automatic diagnostics.
- Validate and limit title/body length; render submitted text as text, never executable markup. Limit repeated submissions. Design retention and deletion before installation.
- No screenshots, file uploads, automatic device details, email delivery, external issue-tracker posting, or public voting in the first release. These require separate privacy and abuse review if later requested.

## Submission audience

Will chose signed-in members only so the owner can reply to the correct account. Do not add anonymous intake or require a separate contact email. Account identity must come from the verified session, never from a member-editable form field.

## Acceptance

1. A signed-in sender can submit each type, sees a receipt, and can view only their own history, current state, and replies. A signed-out visitor cannot submit.
2. A submission failure preserves the entered report and gives a useful recovery path.
3. The owner can list, read, reply, and change triage states. The sender can answer the owner. A second account cannot read, reply to, or change another person's report, even by direct request.
4. Length and repeat-submission limits work, dangerous text renders harmlessly, and no report appears in public project status or Lodge/Guild views.
5. The form and owner inbox work on a phone and with a keyboard and screen reader.

Record local checks and real-account hosted acceptance separately. A-18 stays open until live boundaries are verified.
