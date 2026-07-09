# @playgenx/prompts

Prompt templates for educational artifact generation.

## What's in here

- `playgroundPrompt(request)` — the only prompt template in v0.1.0. Given
  an `ArtifactRequest`, returns a string ready to send to the LLM.

The other kinds (`poll`, `quiz`, `simulation`, `flashcards`, `lab`) get
their prompt templates in 0.1.1.

## Usage

You probably don't need to call these directly — `generatePlayground` from
`@playgenx/core` uses them under the hood.

```ts
import { playgroundPrompt } from '@playgenx/prompts';

const prompt = playgroundPrompt({
  context: 'Lecture on binary search.',
  concept: 'binary search',
  kind: 'playground',
});
```

## Adding a new kind

1. Add a new function in `src/<kind>.ts` (see `playground.ts` for the
   shape).
2. Re-export it from `src/index.ts`.
3. Add a test in `src/<kind>.test.ts`.
4. Wire it into `generatePlayground` (or a new `generateX` function) in
   `@playgenx/core`.
5. Add the kind to the `ArtifactKind` union in `@playgenx/types`.
