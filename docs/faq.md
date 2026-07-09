# FAQ

## What is PlayGenX in one sentence?

A small TypeScript library that turns lecture context into interactive
educational artifacts (playgrounds, quizzes, polls, simulations,
flashcards) using LLMs.

## What models are supported?

In v0.1.0: any OpenAI-compatible endpoint via `OpenAIProvider`, plus
`MockProvider` for tests. Adding a new provider is a 20-line class —
see [`docs/guides/custom-provider.md`](./guides/custom-provider.md).

## Why only `playground` in v0.1.0?

Scope. We wanted to ship one real, end-to-end path with full
docs and CI before fanning out to other kinds. `poll`, `quiz`,
`simulation`, `flashcards`, `lab` are reserved names — they ship in
0.1.1 with prompt templates.

## Is the validator a security boundary?

**No.** It rejects obvious badness (`eval`, `import`, unknown
components) but is not a sandbox. Render validator-passing output in a
sandboxed context (the playground uses `<iframe sandbox="allow-scripts">`).
See [`docs/guides/security.md`](./guides/security.md).

## Why one published package and not 8?

Less surface to track, less version drift, smaller install footprint.
You install `@playgenx/core` and get everything. The other packages are
private workspace deps that get re-exported through core.

## How do I add a custom provider?

Implement the `Provider` interface from `@playgenx/types`. See
[`docs/guides/custom-provider.md`](./guides/custom-provider.md) for a
worked Ollama example.

## How do I add a custom validator?

Pass a `validate` option to `generatePlayground`:

```ts
await generatePlayground(req, {
  provider: new OpenAIProvider(),
  validate: (body) => (body.includes('nope') ? 'contains nope' : null),
});
```

See [`docs/guides/custom-validator.md`](./guides/custom-validator.md).

## Can I use PlayGenX from the browser?

You can, but **don't** ship API keys to the browser. The
`apps/playground` dev app does this as a local-dev convenience and is
documented as such. For production, call the SDK from a server.

## How big is the install?

`@playgenx/core` has zero runtime dependencies. The `OpenAIProvider`
uses raw `fetch` (Node 18+, Bun, Deno, modern browsers). The
playground app is Vite + React — your usual bundle size.

## What license is this?

MIT. See [LICENSE](../../LICENSE).

## How do I report a security issue?

Email **security@xorinf.dev**. Don't open a public issue. See
[SECURITY.md](../../SECURITY.md).

## How do I contribute?

See [CONTRIBUTING.md](../../CONTRIBUTING.md). TL;DR: fork → branch →
PR. Smaller PRs merge faster. Run `pnpm run verify` before pushing.
