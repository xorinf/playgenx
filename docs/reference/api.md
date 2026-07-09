# API Reference

This is the complete public API of the PlayGenX SDK as of v0.1.0.
Everything below is exported from `playgenx`. If you find yourself
importing from a different `@playgenx/*` package directly, you can almost
certainly do it from core instead.

## High-level

### `generatePlayground(request, options)`

```ts
async function generatePlayground(
  request: ArtifactRequest,
  options: GeneratePlaygroundOptions,
): Promise<ArtifactResult>;
```

Runs the full pipeline: prompt → provider → parse → validate.

| Parameter | Type                  | Notes                                  |
| --------- | --------------------- | -------------------------------------- |
| `request` | `ArtifactRequest`     | Required.                              |
| `options` | `GeneratePlaygroundOptions` | Required.                       |

`GeneratePlaygroundOptions`:

| Field      | Type                     | Default            | Notes                                |
| ---------- | ------------------------ | ------------------ | ------------------------------------ |
| `provider` | `Provider`               | — (required)       | No default — kept explicit.          |
| `model`    | `string`                 | provider's `defaultModel` | Override the model.            |
| `registry` | `Registry`               | `DEFAULT_REGISTRY` | Component allowlist.                 |
| `validate` | `(body: string) => string \| null` | built-in `validate` | Plug in your own validator. |

**Returns** `Promise<ArtifactResult>` — discriminated union:

```ts
{ ok: true;  artifact: Artifact }
{ ok: false; error: ArtifactError }
```

`ArtifactError.stage` is one of `'prompt' | 'provider' | 'parse' | 'validate'`.

## Types

### `ArtifactRequest`

```ts
interface ArtifactRequest {
  context: string;
  concept: string;
  kind: ArtifactKind;
  promptOverride?: string;
}
```

### `Artifact`

```ts
interface Artifact {
  kind: ArtifactKind;
  body: string;
  providerId: string;
  model: string;
}
```

### `ArtifactError`

```ts
interface ArtifactError {
  kind: ArtifactKind;
  providerId?: string;
  stage: 'prompt' | 'provider' | 'parse' | 'validate';
  message: string;
  line?: number;
}
```

### `ArtifactResult`

```ts
type ArtifactResult =
  | { ok: true; artifact: Artifact }
  | { ok: false; error: ArtifactError };
```

### `ArtifactKind`

```ts
type ArtifactKind =
  | 'playground'
  | 'poll'
  | 'quiz'
  | 'simulation'
  | 'flashcards'
  | 'lab';
```

Only `'playground'` is fully wired in v0.1.0. Others are reserved names
and will land in 0.1.1.

### `Provider`

```ts
interface Provider {
  readonly id: string;
  readonly defaultModel: string;
  complete(prompt: string, options?: { model?: string }): Promise<string>;
}
```

Implement this to add your own provider.

## Parser

### `extractArtifact(raw)`

```ts
function extractArtifact(raw: string): ExtractResult;
```

`ExtractResult`:

```ts
type ExtractKind = 'tsx' | 'html' | 'plain';
interface ParseError { message: string; line?: number }
type ExtractResult =
  | { ok: true; kind: ExtractKind; body: string }
  | { ok: false; error: ParseError };
```

Finds the first fenced code block (` ```tsx `, ` ```html `, ` ```jsx `, or
untagged) and returns its contents. Falls back to shape-detection for
unfenced input. Real syntax-aware parsing lands in 0.2.0.

## Validators

### `validate(body, registry?)`

```ts
function validate(body: string, registry?: Registry): ValidationError | null;
```

`ValidationError`:

```ts
interface ValidationError { message: string; line?: number }
```

Returns `null` on success, or a `ValidationError` on the first failure.

Checks, in order:

1. No `eval(`.
2. No `new Function(`.
3. No `import` or `require(`.
4. JSX tags roughly balanced.
5. Every capitalized tag is in `registry` (or `BUILT_IN_TAGS`).

## Registry

### `Registry`

```ts
interface Registry {
  isAllowed(name: ComponentName): boolean;
  list(): readonly ComponentName[];
  add(name: ComponentName): void;
}
```

### `createRegistry(seed?)`

```ts
function createRegistry(seed?: readonly ComponentName[]): Registry;
```

### `DEFAULT_REGISTRY`

```ts
const DEFAULT_REGISTRY: Registry;
```

Seeded with: `Button, TextField, Slider, Chart, Container, Code, Heading,
Text, Stepper, Card, List`.

### `BUILT_IN_TAGS`

```ts
const BUILT_IN_TAGS: readonly string[];
```

Lowercase tags the validator always allows:
`div, span, p, h1, h2, h3, h4, h5, h6, ul, ol, li, code, pre, button,
input, label, br, hr, section, article, main, header, footer, nav`.

## Providers

### `MockProvider`

```ts
class MockProvider implements Provider {
  readonly id: 'mock';
  readonly defaultModel: 'mock-1';
  complete(prompt: string, options?: { model?: string }): Promise<string>;
}
```

Deterministic, network-free. Returns the prompt wrapped in a fixed body.
Use for tests and offline development.

### `OpenAIProvider`

```ts
class OpenAIProvider implements Provider {
  readonly id: 'openai';
  readonly defaultModel: string;  // 'gpt-4o-mini'
  constructor(options?: OpenAIProviderOptions);
  complete(prompt: string, options?: { model?: string }): Promise<string>;
}

interface OpenAIProviderOptions {
  apiKey?: string;        // defaults to process.env.OPENAI_API_KEY
  baseUrl?: string;       // defaults to 'https://api.openai.com'
  defaultModel?: string;  // defaults to 'gpt-4o-mini'
  temperature?: number;   // defaults to 0.7
}
```

Uses raw `fetch` — no SDK dep. The API key is read lazily so the env var
can be set after construction.

### `OpenAIError`

```ts
class OpenAIError extends Error {
  readonly status?: number;
  override readonly cause?: unknown;
}
```

Thrown on any provider failure. `status` is the HTTP status when available.

## Utils

### `tagNames(body)`

```ts
function tagNames(body: string): string[];
```

Capitalized JSX tag names, deduplicated.

### `hasBalancedTags(body)`

```ts
function hasBalancedTags(body: string): boolean;
```

Naive open/close count. Self-closing ignored. v0.2.0 will use a real AST.

### `stripCodeComments(body)`

```ts
function stripCodeComments(body: string): string;
```

Strips `//` and `/* */`, preserves newlines.

### `lineOfFirst(text, needle)`

```ts
function lineOfFirst(text: string, needle: string): number | undefined;
```

1-indexed line of first occurrence.

## Prompts

### `playgroundPrompt(request)`

```ts
function playgroundPrompt(request: ArtifactRequest): string;
```

The v0.1.0 prompt template. Appends `request.promptOverride` if set.
