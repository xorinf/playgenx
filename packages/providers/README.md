# @playgenx/providers

LLM provider implementations for PlayGenX. Every provider implements the
shared `Provider` contract from `@playgenx/types`. The core SDK consumes this
interface and never references concrete providers directly — you pass a
provider in by hand.

## Install

```sh
pnpm add @playgenx/providers
```

> This package is internal to the PlayGenX monorepo for now. The public
> surface of the SDK is `@playgenx/core`, which re-exports these classes.

## Quickstart (offline, no API key)

```ts
import { generatePlayground } from '@playgenx/core';
import { MockProvider } from '@playgenx/providers';

const result = await generatePlayground(
  { context: 'Lecture on binary search.', concept: 'binary search', kind: 'playground' },
  { provider: new MockProvider() },
);
console.log(result);
```

## OpenAI

```ts
import { generatePlayground } from '@playgenx/core';
import { OpenAIProvider } from '@playgenx/providers';

const provider = new OpenAIProvider(); // reads OPENAI_API_KEY from env
const result = await generatePlayground(
  { context: 'Lecture notes…', concept: 'recursion', kind: 'playground' },
  { provider, model: 'gpt-4o-mini' },
);
```

The key is read from `process.env.OPENAI_API_KEY` lazily on every call, so
you can set the env var after constructing the provider if you like. You can
also pass it explicitly:

```ts
new OpenAIProvider({ apiKey: 'sk-…' });
```

### Custom base URL

Useful for OpenAI-compatible services (Together, OpenRouter, self-hosted
vLLM, etc.):

```ts
new OpenAIProvider({ baseUrl: 'https://openrouter.ai/api' });
```

## Security

**Do not ship your OpenAI API key to the browser.** The `apps/playground`
Vite app does direct browser → OpenAI calls as a local-dev convenience only.
For production, call `OpenAIProvider` from a server and proxy the request
through your own backend.

## API

- `MockProvider` — deterministic, no network, returns the prompt wrapped in
  a fixed artifact body. Use for tests and offline development.
- `OpenAIProvider` — real OpenAI Chat Completions via raw `fetch`. No SDK
  dependency, Node 18+ / Bun / Deno / modern browsers.
- `OpenAIError extends Error` — `status?: number`, `cause?: unknown`.
- `OpenAIProviderOptions` — `{ apiKey?, baseUrl?, defaultModel?, temperature? }`.
