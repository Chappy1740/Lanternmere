// PreToolUse hook for Bash: always deny skipping git hooks; force Will's
// approval prompt for any push or change to the git hooks path.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const command = String(input.tool_input?.command ?? '');
const decide = (permissionDecision, permissionDecisionReason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision,
        permissionDecisionReason,
      },
    }),
  );
  process.exit(0);
};

if (
  /--no-verify\b/.test(command) ||
  /\bgit\b[^;&|\n]*\bcommit\b[^;&|\n]*\s-[A-Za-z]*n[A-Za-z]*\b/.test(command)
) {
  decide('deny', 'Skipping git hooks (--no-verify / commit -n) is never allowed in Lanternmere.');
}
if (/\s-c\s*core\.hooksPath/i.test(command))
  decide('deny', 'Overriding the git hooks path for one command skips the hooks. Never allowed.');
if (/core\.hooksPath/i.test(command))
  decide('ask', 'Changes which git hooks run. Needs Will’s approval.');
if (/\bgit\b[^;&|\n]*\bpush\b/.test(command))
  decide('ask', 'git push needs Will’s approval for this exact push.');
process.exit(0);
