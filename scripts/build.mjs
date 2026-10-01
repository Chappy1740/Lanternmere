import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const workersBuild = process.env.WORKERS_CI === '1' || args.includes('--workers');
const publicVariableNames = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
if (process.env.WORKERS_CI === '1') {
  const missing = publicVariableNames.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(
      `Missing Workers Builds variables: ${missing.join(', ')}. Set these under Settings > Builds > Build variables and secrets.`,
    );
    process.exit(1);
  }
}
const executable = workersBuild
  ? join(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
  : require.resolve('next/dist/bin/next');

process.stdout.write(`Building ${workersBuild ? 'Cloudflare Workers with vinext' : 'Next.js'}.\n`);
const result = spawnSync(
  process.execPath,
  [executable, 'build', ...args.filter((arg) => arg !== '--workers')],
  {
    stdio: 'inherit',
  },
);
if (result.error) {
  console.error(result.error.message);
}
if (workersBuild && result.status === 0) {
  const configPath = join(process.cwd(), 'dist/server/wrangler.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const publicVars = Object.fromEntries(
    publicVariableNames
      .filter((name) => process.env[name]?.trim())
      .map((name) => [name, process.env[name]]),
  );
  config.previews = { ...config.previews, vars: { ...config.previews?.vars, ...publicVars } };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
process.exit(result.status ?? 1);
