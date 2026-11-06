// Stop hook: if code changed and no check report matches the current diff,
// block finishing once. Docs-only work is never blocked.
import { existsSync, readFileSync } from 'node:fs';
import { codeDiffState, reportPath } from './diff-state.mjs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const say = (obj) => process.stdout.write(JSON.stringify(obj));

let state;
try {
  state = codeDiffState(cwd);
} catch (error) {
  say({ systemMessage: `Test-report check could not read git state: ${error.message}` });
  process.exit(0);
}
if (!state.changed) process.exit(0);

const path = reportPath(cwd, state.hash);
if (existsSync(path)) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  if (!report.allPassed)
    say({ systemMessage: `Checks FAILED for diff ${state.hash}. Report: ${path}` });
  process.exit(0);
}
if (input.stop_hook_active) {
  // Already blocked once: let the session end (no endless loop) but warn Will plainly.
  say({
    systemMessage: `WARNING: session ended WITHOUT a test report for code diff ${state.hash}.`,
  });
  process.exit(0);
}
say({
  decision: 'block',
  reason: `Code changed (diff ${state.hash}) but no test report matches it. Run: node .claude/hooks/run-checks.mjs, then show Will the raw output.`,
});
