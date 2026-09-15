# LANTERNMERE SESSION RULES

We are continuing the Lanternmere project.

Work efficiently and minimize unnecessary usage during this session.

Follow these rules:

1. Keep responses concise.
2. Give me only ONE implementation step at a time.
3. Do not repeat information I already have.
4. Do not provide long explanations unless I ask for them.
5. Do not rewrite entire files when a small targeted change is enough.
6. Before changing code, inspect the existing repository and relevant files.
7. Use the permanent Lanternmere documentation in the repository as the source of truth.
8. Do not rely on old ChatGPT conversation history when the repo documentation answers the question.
9. Do not explore unrelated files or perform broad searches unless necessary.
10. Do not make speculative changes.
11. Make the smallest safe change that completes the current step.
12. After each step:
    - Tell me briefly what changed.
    - Tell me how to validate it.
    - Then STOP and wait for me to say "Next".
13. Do not automatically continue into the next task or milestone.
14. If something is already correct, say so and do not change it.
15. Preserve the existing Lanternmere architecture, naming conventions, security model, and documentation.
16. Prefer targeted commands, targeted file reads, and targeted diffs instead of scanning the entire repository repeatedly.
17. Do not generate large summaries after every step.
18. Only show code I need to copy manually. If Codex can make the change directly, make the change instead.
19. Keep Git commits focused on the current task.
20. Before committing, review the diff for accidental or unrelated changes.

## SESSION WORKFLOW

Inspect → Make one focused change → Validate → Briefly report → STOP.

Do not continue until I say "Next."

Current task:
[PASTE THE TASK OR MILESTONE HERE]
