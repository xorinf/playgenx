# Custom provider

Adding your own provider is a 20-line class. Here's a complete working
example that wraps the [Ollama](https://ollama.com) HTTP API. Drop it
into your project.

```ts
// src/my-ollama-provider.ts
import type { Provider } from '@playgenx/types';

export class OllamaProvider implements Provider {
  readonly id = 'ollama';
  readonly defaultModel: string;

  constructor(private readonly options: { baseUrl?: string; defaultModel?: string } = {}) {
    this.defaultModel = options.defaultModel ?? 'llama3.1';
  }

  async complete(prompt: string, opts?: { model?: string }): Promise<string> {
    const url = `${this.options.baseUrl ?? 'http://localhost:11434'}/api/generate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: opts?.model ?? this.defaultModel, prompt, stream: false }),
    });
    if (!res.ok) {
      throw new Error(`Ollama request failed (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { response?: string };
    if (typeof data.response !== 'string') {
      throw new Error('Ollama response missing `response` field');
    }
    return data.response;
  }
}
```

## Use it

```ts
import { generatePlayground } from 'playgenx';
import { OllamaProvider } from './my-ollama-provider.js';

const result = await generatePlayground(
  { concept: 'recursion', context: '…', kind: 'playground' },
  { provider: new OllamaProvider() },
);
```

## Rules of the road

1. `id` must be unique and stable. Use the same one across runs so
   result objects stay comparable.
2. `defaultModel` is what the SDK uses when the caller doesn't pass one.
   Pick a sensible default — usually the provider's cheapest / fastest
   model.
3. `complete` must return the raw text. Don't JSON-parse it, don't strip
   code fences, don't try to be clever. The parser does that.
4. `complete` should throw on any failure (network, HTTP, malformed
   response). The pipeline catches the throw and wraps it as
   `{ ok: false, error: { stage: 'provider', … } }`.
5. Don't read env vars from the constructor — read them lazily in
   `complete` (or accept the value explicitly via the options bag). The
   SDK wants to support the case where the user sets the env var after
   constructing the provider.

## Re-export from your package

If you're shipping a package of providers, re-export the class from your
`index.ts` so users can do `import { OllamaProvider } from 'your-pkg'`.

## Adding a custom error class (optional)

For nicer error handling, follow the `OpenAIError` pattern:

```ts
export class OllamaError extends Error {
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'OllamaError';
    this.status = options.status;
    this.cause = options.cause;
  }
}
```

The pipeline will still surface it correctly — the `stage` is
`'provider'` either way — but having a typed error makes `instanceof`
checks easy in user code.
