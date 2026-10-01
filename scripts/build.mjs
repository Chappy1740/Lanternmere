import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const workersBuild = process.env.WORKERS_CI === '1';
const executable = workersBuild
  ? join(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
  : require.resolve('next/dist/bin/next');

process.stdout.write(`Building ${workersBuild ? 'Cloudflare Workers with vinext' : 'Next.js'}.\n`);
const result = spawnSync(process.execPath, [executable, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
if (result.error) {
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
