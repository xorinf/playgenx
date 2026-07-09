# @playgenx/types

Pure TypeScript types for the PlayGenX SDK. No runtime code, no business
logic — just shared interfaces consumed by every other package.

## What's in here

- `Provider` — the LLM provider contract (`id`, `defaultModel`, `complete`).
- `ArtifactRequest` — what you pass to a `generateX` function.
- `Artifact` — the success result.
- `ArtifactError` — the failure result, with a `stage` (`prompt` |
  `provider` | `parse` | `validate`) so you know which pipeline stage
  failed.
- `ArtifactResult` — the discriminated union returned by every `generateX`.
- `ArtifactKind` — the union of supported kinds
  (`playground | poll | quiz | simulation | flashcards | lab`).

## Usage

You probably don't need to import from here directly — `playgenx`
re-exports everything. But if you're building an integration that lives
alongside the SDK (e.g. a custom playground UI), you can:

```ts
import type { ArtifactRequest, Provider } from '@playgenx/types';
```
