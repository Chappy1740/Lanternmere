import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Existing CJS/MJS entries are self-contained mocked scripts. SQL rehearsals
// are deliberately excluded: they require separate disposable-data approval.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
function entries(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? entries(path) : /\.(cjs|mjs)$/.test(entry.name) ? [path] : [];
  });
}
const files = entries(join(root, 'tests')).sort();
if (files.length === 0) throw new Error('No mocked test entry points found.');
let failures = 0;
for (const path of files) {
  process.stdout.write(`\nRunning ${relative(root, path)}\n`);
  const result = spawnSync(process.execPath, ['--experimental-strip-types', path], {
    cwd: root,
    stdio: 'inherit',
    timeout: 60_000,
  });
  if (result.error || result.status !== 0) {
    failures++;
    console.error(`Failed: ${relative(root, path)} (${result.error?.message ?? result.status})`);
  }
}
process.stdout.write(`\nMocked entry points: ${files.length - failures}/${files.length} passed.\n`);
process.exitCode = failures ? 1 : 0;
