/* eslint-disable @typescript-eslint/no-require-imports, no-console -- Environment validation diagnostics regression. */
// Hosted deploy validation shows only the thrown message, so it must name the
// failing variables. Neither the message nor console output may include values.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
function validate(file, env) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const logged = [];
  try {
    vm.runInNewContext(code, {
      exports,
      process: { env },
      console: { error: (...args) => logged.push(JSON.stringify(args)) },
      require(name) {
        if (name === 'server-only') return {};
        if (name === 'zod') return require('zod');
        throw new Error(`Unexpected dependency ${name}`);
      },
    });
    return { exports, error: null, log: logged.join('\n') };
  } catch (error) {
    return { exports, error, log: logged.join('\n') };
  }
}
function assertNoValues(result, values) {
  for (const value of values) {
    assert.ok(!result.error.message.includes(value), 'Thrown message must not include values');
    assert.ok(!result.log.includes(value), 'Console diagnostics must not include values');
  }
}

const secret = 'sb_secret_DO_NOT_PRINT_1234567890';
const badUrl = 'not a url with private-token-abc';
const serverBase = { SUPABASE_SERVICE_ROLE_KEY: secret, NODE_ENV: 'production' };

// Valid configuration loads without throwing.
const valid = validate('src/lib/env.server.ts', serverBase);
assert.equal(valid.error, null);
assert.equal(valid.exports.serverEnv.SUPABASE_SERVICE_ROLE_KEY, secret);

// Missing required key, invalid optional values and an empty optional value are all named.
const server = validate('src/lib/env.server.ts', {
  BLIZZARD_CLIENT_SECRET: 'blizzard-secret-value-xyz',
  BLIZZARD_REDIRECT_URI: badUrl,
  BLIZZARD_REGION: 'moon',
  WARCRAFT_LOGS_CLIENT_ID: '',
  NODE_ENV: 'production',
});
assert.equal(
  server.error?.message,
  'Invalid server environment variables: BLIZZARD_REDIRECT_URI, BLIZZARD_REGION, SUPABASE_SERVICE_ROLE_KEY, WARCRAFT_LOGS_CLIENT_ID. Values are not logged.',
);
assertNoValues(server, ['blizzard-secret-value-xyz', badUrl, 'private-token-abc', 'moon']);

// A present secret beside an unrelated invalid variable is never echoed.
const leak = validate('src/lib/env.server.ts', {
  ...serverBase,
  APP_OWNER_PROFILE_ID: 'not-a-uuid',
});
assert.equal(
  leak.error?.message,
  'Invalid server environment variables: APP_OWNER_PROFILE_ID. Values are not logged.',
);
assertNoValues(leak, [secret, 'not-a-uuid']);

// Client validation follows the same naming rule.
const client = validate('src/lib/env.client.ts', { NEXT_PUBLIC_SUPABASE_URL: badUrl });
assert.equal(
  client.error?.message,
  'Invalid client environment variables: NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL. Values are not logged.',
);
assertNoValues(client, [badUrl, 'private-token-abc']);

console.log('Environment validation names failing variables without values.');
