# OpenAI setup

This guide gets you from "I have an OpenAI account" to "I'm running the
playground against a real model."

## 1. Get an API key

1. Go to <https://platform.openai.com/api-keys>.
2. Click **Create new secret key**.
3. Copy the key. You won't see it again.

## 2. Set the key as an env var

```sh
export OPENAI_API_KEY=sk-…
```

Persist this in your shell profile (~/.zshrc, ~/.bashrc) or in a
project-local `.env` file. **Do not commit it.**

## 3. Use it in code

The simplest path:

```ts
import { generatePlayground, OpenAIProvider } from '@playgenx/core';

const result = await generatePlayground(
  { concept: 'recursion', context: '…', kind: 'playground' },
  { provider: new OpenAIProvider() },
);
```

`OpenAIProvider` reads `OPENAI_API_KEY` lazily on every call — so you
can set the env var after constructing the provider if you like.

You can also pass the key explicitly:

```ts
new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY });
```

## 4. Pick a model

The default is `gpt-4o-mini` — fast and cheap. Override per-call:

```ts
await generatePlayground(req, {
  provider: new OpenAIProvider(),
  model: 'gpt-4o',
});
```

Or set a different default for the provider:

```ts
new OpenAIProvider({ defaultModel: 'gpt-4o' });
```

## 5. Custom base URL

For OpenAI-compatible services (Together, OpenRouter, self-hosted vLLM):

```ts
new OpenAIProvider({ baseUrl: 'https://openrouter.ai/api' });
```

## 6. Run the playground

The dev UI is the fastest way to iterate:

```sh
echo 'VITE_OPENAI_API_KEY=sk-…' > apps/playground/.env
pnpm dev:playground
```

Then open the URL Vite prints.

## Security: do not deploy the playground to a public host

The playground calls OpenAI **directly from the browser**. The
`VITE_OPENAI_API_KEY` is bundled into the JavaScript and visible to
anyone who opens DevTools. The playground is a **local-dev tool only**.

For production, run `OpenAIProvider` on a server and proxy the request
through your own backend. See
[`docs/guides/security.md`](./security.md).
