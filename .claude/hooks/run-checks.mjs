// Runs Lanternmere's local checks and saves a report tied to the current diff.
// Same checks CI runs first; build steps stay in CI because they need build secrets.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { codeDiffState, reportPath } from './diff-state.mjs';

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CHECKS = [
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'test:mocked']],
];
const state = codeDiffState(cwd);
const results = [];
for (const [cmd, args] of CHECKS) {
  const command = `${cmd} ${args.join(' ')}`;
  process.stdout.write(`\n$ ${command}\n`);
  const run = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  process.stdout.write(output);
  const exitCode = run.error ? `error: ${run.error.message}` : run.status;
  process.stdout.write(`[exit ${exitCode}]\n`);
  results.push({ command, exitCode, outputTail: output.split('\n').slice(-200).join('\n') });
}
const report = {
  diffHash: state.hash,
  base: state.base,
  createdAt: new Date().toISOString(),
  ranBy: 'Claude Code session (local)',
  allPassed: results.every((r) => r.exitCode === 0),
  results,
};
const path = reportPath(cwd, state.hash);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(report, null, 2));
process.stdout.write(`\nReport: ${path} (allPassed: ${report.allPassed})\n`);
process.exit(report.allPassed ? 0 : 1);
