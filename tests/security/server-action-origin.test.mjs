import assert from 'node:assert/strict';
import test from 'node:test';
import nextConfig from '../../next.config.ts';
import { validateCsrfOrigin } from '../../node_modules/vinext/dist/server/request-pipeline.js';

test('native form submissions retain their origin without sharing external referrers', async () => {
  const rules = await nextConfig.headers();
  const policy = rules
    .find((rule) => rule.source === '/:path*')
    .headers.find((header) => header.key.toLowerCase() === 'referrer-policy');
  // no-referrer turns navigate-mode POST Origins into null, which vinext rejects.
  // same-origin keeps a native same-origin form usable and sends no external Referer.
  assert.equal(policy.value, 'same-origin');
});

test('the Worker accepts same-origin actions while rejecting foreign and opaque origins', () => {
  const url = 'https://lanternmere.lanternmere-wow.workers.dev/sign-in';
  const request = (origin) =>
    new Request(url, {
      method: 'POST',
      headers: { origin, host: new URL(url).host },
    });
  assert.equal(validateCsrfOrigin(request(new URL(url).origin)), null);
  for (const origin of ['https://foreign.example', 'null']) {
    const rejection = validateCsrfOrigin(request(origin));
    assert.equal(rejection.status, 403);
  }
  assert.equal(nextConfig.experimental.serverActions.allowedOrigins, undefined);
});
