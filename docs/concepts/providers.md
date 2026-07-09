# Providers

A `Provider` is the SDK's name for "thing that turns a prompt into a
string of text." In practice, it's an LLM. The core SDK never imports a
concrete provider — it consumes the `Provider` interface from
`@playgenx/types`.

## The interface

```ts
interface Provider {
  readonly id: string;
  readonly defaultModel: string;
  complete(prompt: string, options?: { model?: string }): Promise<string>;
}
```

- `id` — a stable string (`'mock'`, `'openai'`, `'ollama'`, …). Used in
  result objects and logs.
- `defaultModel` — what the provider uses when the caller doesn't pass
  one.
- `complete` — the actual call. Must return the raw text the model
  produced. Throws on any failure; the pipeline catches the throw and
  wraps it as `{ ok: false, error: { stage: 'provider', … } }`.

## Built-in providers

- **`MockProvider`** — deterministic, network-free. Returns the prompt
  wrapped in a fixed template. Use for tests and offline development.
- **`OpenAIProvider`** — real OpenAI Chat Completions via raw `fetch`.
  No SDK dep. Reads `OPENAI_API_KEY` lazily.

## Adding your own

It's a 20-line class. See
[`docs/guides/custom-provider.md`](../guides/custom-provider.md) for a
worked example.

## Choosing `defaultModel`

The provider's `defaultModel` is what the SDK uses when the caller
doesn't override. Pick a sensible default — usually the provider's
fastest cheap model (`gpt-4o-mini`, `claude-3-5-haiku`, `llama-3.1-8b`,
etc.) — and let callers opt up to something more expensive.

## Don't import concrete providers from `playgenx`

If you find yourself wanting to do `import { OpenAIProvider } from
'playgenx/providers/openai'`, stop — just import from
`playgenx`. Re-exports are the whole point.

If you want to swap providers at runtime (e.g. based on a feature flag),
the pattern is:

```ts
const provider = useOpenAI
  ? new OpenAIProvider()
  : new OllamaProvider({ baseUrl: 'http://localhost:11434' });

await generatePlayground(req, { provider });
```

The pipeline doesn't care which one it gets.
