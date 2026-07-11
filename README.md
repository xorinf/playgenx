# PlayGenX

> Open-source TypeScript SDK for turning lecture context into interactive
> educational experiences — playgrounds, quizzes, polls, simulations, and
> flashcards — using LLMs.

[![CI](https://img.shields.io/github/actions/workflow/status/xorinf/playgenx/ci.yml?branch=main&label=CI)](https://github.com/xorinf/playgenx/actions)
[![npm](https://img.shields.io/npm/v/playgenx)](https://www.npmjs.com/package/playgenx)
![license](https://img.shields.io/github/license/xorinf/playgenx)
![typescript](https://img.shields.io/badge/TypeScript-strict-blue)
![pnpm](https://img.shields.io/badge/pnpm-9+-orange)

## What is this?

You give it a `concept` and some `context` (lecture notes, transcript, your
brain dump). It calls an LLM, parses the response, validates it against a
component allowlist, and hands you back a structured artifact you can
render or ship.

```ts
import { generatePlayground, OpenAIProvider } from 'playgenx';

const result = await generatePlayground(
  {
    concept: 'binary search',
    context: 'Binary search finds an item in a sorted array in O(log n) time…',
    kind: 'playground',
  },
  { provider: new OpenAIProvider() },
);

if (result.ok) {
  console.log(result.artifact.body); // clean, validated TSX
} else {
  console.error(result.error.stage, result.error.message);
}
```

## Status

**v0.1.0 — MVP.** One real provider (OpenAI), a full parse → validate
pipeline, a local playground app, full docs. See
[`CHANGELOG.md`](./CHANGELOG.md) and the [roadmap](./docs/roadmap.md) for
what's next and what we deliberately left out.

## Quickstart (offline, no API key)

```sh
pnpm add playgenx
```

```ts
import { generatePlayground, MockProvider } from 'playgenx';

const result = await generatePlayground(
  { concept: 'binary search', context: 'Lecture on binary search.', kind: 'playground' },
  { provider: new MockProvider() },
);
```

`MockProvider` returns a deterministic, network-free response. Use it for
tests and offline development.

## Real provider (OpenAI)

```sh
export OPENAI_API_KEY=sk-…
```

```ts
import { generatePlayground, OpenAIProvider } from 'playgenx';

const result = await generatePlayground(
  { concept: 'recursion', context: '…', kind: 'playground' },
  { provider: new OpenAIProvider(), model: 'gpt-4o-mini' },
);
```

The provider reads `OPENAI_API_KEY` from the env at call time. You can also
pass it explicitly: `new OpenAIProvider({ apiKey: 'sk-…' })`. See
[`docs/guides/openai.md`](./docs/guides/openai.md).

## Supported artifact kinds

| Kind         | Status | Body shape                                                   |
| ------------ | :----: | ------------------------------------------------------------ |
| `playground` |   ✅   | TSX/HTML — a self-contained interactive component.           |
| `poll`       |   ✅   | JSON — a single multiple-choice question with 2–4 options.   |
| `quiz`       |   ✅   | JSON — 3–8 questions, each with options and an answer.       |
| `simulation` |   ✅   | TSX/HTML — interactive component with state and progression. |
| `flashcards` |   ✅   | JSON — 5–20 cards, each with a front and back.               |
| `lab`        |   ✅   | TSX/HTML — multi-step guided exploration with hints.         |

All kinds ship in 0.2.0. Generate with `generatePlayground`, `generatePoll`,
`generateQuiz`, `generateSimulation`, `generateFlashcards`, or `generateLab`.

## Architecture

```
caller → generatePlayground(req, { provider, model?, registry?, validate? })
         │
         ├── playgroundPrompt(req)              [prompts]
         ├── provider.complete(prompt, opts)    [providers — injected]
         ├── parser.extract(raw)                [parser — pure]
         ├── validators.check(body, registry)   [validators — pure]
         └── return { ok, artifact } | { ok, error, stage }
```

Every stage is pure except `provider.complete`. Parser, registry, and
validators do no IO and have no env access. See
[`docs/concepts/pipeline.md`](./docs/concepts/pipeline.md).

## Packages

| Package                                         | Role                                     | Status   |
| ----------------------------------------------- | ---------------------------------------- | -------- |
| [`playgenx`](./packages/core)                   | Public SDK entry. Re-exports everything. | ✅ 0.1.0 |
| [`@playgenx/providers`](./packages/providers)   | Mock + OpenAI provider implementations.  | ✅ 0.1.0 |
| [`@playgenx/prompts`](./packages/prompts)       | Prompt templates.                        | ✅ 0.1.0 |
| [`@playgenx/parser`](./packages/parser)         | LLM response → kinded body.              | ✅ 0.1.0 |
| [`@playgenx/validators`](./packages/validators) | Substring + tag balance + allowlist.     | ✅ 0.1.0 |
| [`@playgenx/registry`](./packages/registry)     | Component allowlist.                     | ✅ 0.1.0 |
| [`@playgenx/utils`](./packages/utils)           | Shared string helpers.                   | ✅ 0.1.0 |
| [`@playgenx/types`](./packages/types)           | Shared TS types.                         | ✅ 0.1.0 |
| [`apps/playground`](./apps/playground)          | Vite + React local-dev UI.               | ✅ 0.1.0 |

> `playgenx` is the only published npm package. All others are
> private workspace deps, re-exported through core. One published surface,
> one version to track.

## Documentation

- [Getting started](./docs/getting-started.md)
- [Pipeline concept](./docs/concepts/pipeline.md)
- [Providers concept](./docs/concepts/providers.md)
- [Registry concept](./docs/concepts/registry.md)
- [Validation concept](./docs/concepts/validation.md)
- [OpenAI guide](./docs/guides/openai.md)
- [Custom provider guide](./docs/guides/custom-provider.md)
- [Custom validator guide](./docs/guides/custom-validator.md)
- [Security guide](./docs/guides/security.md)
- [API reference](./docs/reference/api.md)
- [Roadmap](./docs/roadmap.md)
- [FAQ](./docs/faq.md)

## Examples

Runnable scripts in [`examples/`](./examples):

- `01-node-mock.mjs` — Node + `MockProvider`, no key.
- `02-node-openai.mjs` — Node + `OpenAIProvider`, env-keyed.
- `03-react-vite/` — Minimal Vite+React app embedding the SDK.
- `04-mock-tests.ts` — vitest pattern.

## Roadmap

- **0.1.1** — More `kind`s (poll, quiz, simulation). More providers (Anthropic, Gemini, Ollama).
- **0.2.0** — Real AST-based validation (`@babel/parser` or `acorn`). Real JSX renderer in the playground.
- **0.3.0** — VitePress docs site, streaming responses, multi-turn support.

See [docs/roadmap.md](./docs/roadmap.md) for the full picture.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Bug reports and PRs welcome.

## License

[MIT](./LICENSE) © 2026 xorinf
