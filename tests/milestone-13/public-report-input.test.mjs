import assert from 'node:assert/strict';
import { parsePublicReportCode } from '../../src/lib/warcraft-logs-input.ts';

const code = 'AbC123def456GH78';
assert.equal(parsePublicReportCode(code), code);
assert.equal(parsePublicReportCode(`https://www.warcraftlogs.com/reports/${code}`), code);
assert.equal(parsePublicReportCode(`https://warcraftlogs.com/reports/${code}?fight=1`), code);
for (const input of [
  `http://www.warcraftlogs.com/reports/${code}`,
  `https://warcraftlogs.com.evil.example/reports/${code}`,
  `https://evil.example/reports/${code}`,
  `https://warcraftlogs.com:444/reports/${code}`,
  `https://evil@warcraftlogs.com/reports/${code}`,
  `https://www.warcraftlogs.com/private/${code}`,
  'not-a-report',
]) {
  assert.equal(parsePublicReportCode(input), null, input);
}
