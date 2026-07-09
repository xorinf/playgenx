# Getting started

This is a 60-second tour. By the end you'll have the SDK installed and
running a real generation.

## 1. Install

```sh
pnpm add @playgenx/core
```

(Or `npm install @playgenx/core` if you must.)

## 2. Try the offline provider

The SDK ships with a `MockProvider` that doesn't talk to any LLM. Use it
to wire your code first, then swap in a real provider later.

```ts
import { generatePlayground, MockProvider } from '@playgenx/core';

const result = await generatePlayground(
  {
    concept: 'binary search',
    context: 'Binary search finds an item in a sorted array in O(log n) time…',
    kind: 'playground',
  },
  { provider: new MockProvider() },
);

if (result.ok) {
  console.log(result.artifact.body);
} else {
  console.error(result.error.stage, result.error.message);
}
```

`MockProvider` returns a deterministic response — the prompt, wrapped in
a fixed template. Useful for tests and offline development.

## 3. Try a real provider

For OpenAI, set the API key in your env:

```sh
export OPENAI_API_KEY=sk-…
```

```ts
import { generatePlayground, OpenAIProvider } from '@playgenx/core';

const result = await generatePlayground(
  { concept: 'recursion', context: '…', kind: 'playground' },
  { provider: new OpenAIProvider(), model: 'gpt-4o-mini' },
);
```

## 4. Where to go next

- **[API reference](./reference/api.md)** — every public symbol.
- **[OpenAI guide](./guides/openai.md)** — more on the OpenAI provider.
- **[Custom provider guide](./guides/custom-provider.md)** — wrap a
  different LLM in 20 lines.
- **[Pipeline concept](./concepts/pipeline.md)** — what happens under
  the hood.

## 5. Run the playground

The repo includes `apps/playground`, a Vite + React dev UI:

```sh
git clone https://github.com/xorinf/playgenx
cd playgenx
pnpm install
pnpm run build
echo 'VITE_OPENAI_API_KEY=sk-…' > apps/playground/.env
pnpm dev:playground
```

Open the URL Vite prints (usually `http://localhost:5173`).
