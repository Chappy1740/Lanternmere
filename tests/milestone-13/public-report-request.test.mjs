import assert from 'node:assert/strict';
import { requestPublicLogReport } from '../../src/lib/warcraft-logs-request.ts';

const code = 'AbC123def456GH78';
const token = () => Response.json({ access_token: 'synthetic-token' });
const report = (value) => Response.json({ data: { reportData: { report: value } } });
const validReport = {
  code,
  title: 'Synthetic public report',
  startTime: 1000,
  endTime: 2000,
  fights: [],
};

async function lookup(responses, requestedCode = code) {
  const calls = [];
  const result = await requestPublicLogReport(
    requestedCode,
    'synthetic-id',
    'synthetic-secret',
    async (url, options) => {
      calls.push({ url, options });
      return responses.shift();
    },
  );
  return { result, calls };
}

const missing = await requestPublicLogReport(code, undefined, undefined, () => {
  throw new Error('Fetch must not run without credentials');
});
assert.equal(missing.ok, false);
assert.match(missing.message, /unavailable/);

const invalid = await lookup([], 'invalid!');
assert.equal(invalid.result.ok, false);
assert.equal(invalid.calls.length, 0);

const tokenFailure = await lookup([new Response('', { status: 503 })]);
assert.equal(tokenFailure.result.ok, false);
assert.match(tokenFailure.result.message, /authentication/);

const badTokenJson = await lookup([new Response('<html>bad token</html>')]);
assert.match(badTokenJson.result.message, /unexpected token response/);

const throttled = await lookup([token(), new Response('', { status: 429 })]);
assert.match(throttled.result.message, /busy/);

const badReportJson = await lookup([token(), new Response('<html>bad report</html>')]);
assert.match(badReportJson.result.message, /unexpected report response/);

const unreachable = await requestPublicLogReport(
  code, 'synthetic-id', 'synthetic-secret', async () => {
    throw new Error('Synthetic network failure');
  },
);
assert.match(unreachable.message, /could not be reached/);

const absent = await lookup([token(), report(null)]);
assert.match(absent.result.message, /No public report/);

const mismatch = await lookup([token(), report({ ...validReport, code: 'Different123' })]);
assert.match(mismatch.result.message, /different report/);

const success = await lookup([token(), report(validReport)]);
assert.equal(success.result.ok, true);
assert.equal(success.result.report.code, code);
assert.equal(success.calls.length, 2);
assert.equal(success.calls[0].url, 'https://www.warcraftlogs.com/oauth/token');
assert.equal(success.calls[1].url, 'https://www.warcraftlogs.com/api/v2/client');
assert.match(success.calls[1].options.body, /allowUnlisted: false/);
