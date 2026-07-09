// Run me: pnpm dlx tsx examples/01-node-mock.mjs
//
// This is the simplest possible PlayGenX call. No API key, no network.
// `MockProvider` is a deterministic stand-in for a real LLM.

import { generatePlayground, MockProvider } from 'playgenx';

const result = await generatePlayground(
  {
    concept: 'binary search',
    context: 'Binary search finds an item in a sorted array in O(log n) time…',
    kind: 'playground',
  },
  { provider: new MockProvider() },
);

if (result.ok) {
  console.log('Kind:', result.artifact.kind);
  console.log('Provider:', result.artifact.providerId);
  console.log('Model:', result.artifact.model);
  console.log('---');
  console.log(result.artifact.body);
} else {
  console.error('Failed at stage', result.error.stage);
  console.error(result.error.message);
}
