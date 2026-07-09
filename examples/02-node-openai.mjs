// Run me: OPENAI_API_KEY=sk-… pnpm dlx tsx examples/02-node-openai.mjs
//
// Uses the real OpenAI provider. Reads OPENAI_API_KEY from the env.

import { generatePlayground, OpenAIProvider } from '@playgenx/core';

if (!process.env.OPENAI_API_KEY) {
  console.error('Set OPENAI_API_KEY before running this example.');
  process.exit(1);
}

const result = await generatePlayground(
  {
    concept: 'recursion',
    context:
      'A recursive function is one that calls itself. Every recursive function needs a base case…',
    kind: 'playground',
  },
  { provider: new OpenAIProvider(), model: 'gpt-4o-mini' },
);

if (result.ok) {
  console.log('Got artifact from', result.artifact.providerId);
  console.log(result.artifact.body);
} else {
  console.error('Failed at stage', result.error.stage);
  console.error(result.error.message);
}
