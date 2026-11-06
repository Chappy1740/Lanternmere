// Shared helper: fingerprints the current code change so a test report can be
// matched to the exact diff it tested. Docs and Markdown are excluded.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDE = [':(exclude)docs/**', ':(exclude)**/*.md', ':(exclude).claude/reports/**'];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

export function codeDiffState(cwd) {
  let base;
  try {
    base = git(cwd, ['merge-base', 'HEAD', 'origin/main']).trim();
  } catch {
    base = 'HEAD'; // origin/main unknown: only uncommitted changes are fingerprinted
  }
  const diff = git(cwd, ['diff', '--binary', base, '--', '.', ...EXCLUDE]);
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard', '--', '.', ...EXCLUDE])
    .split('\n')
    .filter(Boolean)
    .sort();
  const hash = createHash('sha256').update(diff);
  for (const file of untracked) hash.update(`\0${file}\0`).update(readFileSync(join(cwd, file)));
  return {
    base,
    changed: diff.length > 0 || untracked.length > 0,
    hash: hash.digest('hex').slice(0, 16),
  };
}

export const reportPath = (cwd, hash) => join(cwd, '.claude', 'reports', `checks-${hash}.json`);
