import assert from 'node:assert/strict';
import {
  buildProviderBody,
  parseProviderOutput,
} from '../../src/lib/lanternkeeper/provider-contract.ts';

const fact = {
  id: 'applications',
  text: '2 active applications or trials in up to 200 checked rows; human review is required.',
  source: 'Lanternmere record',
};
const request = buildProviderBody('synthetic-model', 'weekly', [fact]);
assert.equal(request.store, false);
assert.equal(request.max_output_tokens, 300);
assert.equal(request.text.format.strict, true);
assert.equal('tools' in request, false);
assert.deepEqual(JSON.parse(request.input), { view: 'weekly', facts: [fact] });

const response = (suggestions, status = 'completed') => ({
  status,
  output: [
    {
      content: [
        {
          type: 'output_text',
          text: JSON.stringify({
            summary: 'Two applications are recorded.',
            suggestions,
          }),
        },
      ],
    },
  ],
  usage: { input_tokens: 20, output_tokens: 30 },
});
const valid = parseProviderOutput(
  response([{ text: 'Open the Muster.', fact_id: 'applications' }]),
  new Set(['applications']),
);
assert.equal(valid.summary, 'Two applications are recorded.');
assert.equal(valid.outputTokens, 30);
assert.throws(
  () =>
    parseProviderOutput(
      response([{ text: 'Unsupported link.', fact_id: 'unknown-fact' }]),
      new Set(['applications']),
    ),
  /unsupported content/,
);
assert.throws(
  () => parseProviderOutput(response([], 'incomplete'), new Set(['applications'])),
  /incomplete/,
);
