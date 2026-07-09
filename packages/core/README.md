# @playgenx/core

The public PlayGenX SDK. One entry point. Everything else is re-exported
from here.

## Install

```sh
pnpm add @playgenx/core
```

## What's exported

### High-level

- `generatePlayground(request, options)` — runs the full pipeline. Returns
  `{ ok, artifact }` or `{ ok, error, stage }`.

### Re-exports (so you don't have to install the workspace packages)

- `@playgenx/types` — `ArtifactRequest`, `Artifact`, `ArtifactError`,
  `ArtifactErrorStage`, `ArtifactResult`, `ArtifactKind`, `Provider`.
- `@playgenx/parser` — `extractArtifact`, `ExtractKind`, `ParseError`,
  `ExtractResult`.
- `@playgenx/validators` — `validate`, `ValidationError`.
- `@playgenx/registry` — `createRegistry`, `DEFAULT_REGISTRY`,
  `BUILT_IN_TAGS`, `Registry`, `ComponentName`.
- `@playgenx/providers` — `MockProvider`, `OpenAIProvider`, `OpenAIError`,
  `OpenAIProviderOptions`.

## Quickstart

```ts
import { generatePlayground, OpenAIProvider } from '@playgenx/core';

const result = await generatePlayground(
  { concept: 'binary search', context: '…', kind: 'playground' },
  { provider: new OpenAIProvider() },
);

if (result.ok) {
  console.log(result.artifact.body);
} else {
  // result.error.stage is one of: 'parse' | 'validate' | 'provider'
  console.error(result.error.stage, result.error.message);
}
```

## Pipeline

```
1. playgroundPrompt(request)
2. provider.complete(prompt)         → raw string
3. extractArtifact(raw)              → { kind, body } | parse error
4. validate(body, registry)          → null | validation error
5. return { ok, artifact }           ← success
   return { ok: false, error }       ← any failure above
```

## Customising

```ts
import {
  generatePlayground,
  OpenAIProvider,
  createRegistry,
  validate,
} from '@playgenx/core';

const customRegistry = createRegistry(['Button', 'Slider', 'MyWidget']);

const result = await generatePlayground(req, {
  provider: new OpenAIProvider(),
  model: 'gpt-4o-mini',
  registry: customRegistry,
  // Optional: replace the validator entirely.
  validate: (body) => validate(body, customRegistry)?.message ?? null,
});
```

See the [full docs](../../docs/) for guides, concepts, and the API reference.
