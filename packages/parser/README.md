# @playgenx/parser

Extracts a single code artifact from a raw LLM response. Pure functions —
no IO, no env, no network.

## Install

```sh
pnpm add @playgenx/parser
```

## What it does

LLM responses usually include prose around the code we actually want. This
package finds the code block and returns it cleanly.

It understands:

- Fenced code blocks: ` ```tsx `, ` ```html `, ` ```jsx `, untagged ` ``` `
- Unfenced content, shape-detected:
  - starts with `<` and contains `</…>` → `tsx`
  - starts with `function`, `const`, `class`, `export`, etc. → `tsx`
  - otherwise → `plain`

It does NOT (in v0.1.0):

- parse JSX/HTML with a real AST
- detect unfenced HTML that's just a snippet
- handle multiple fenced blocks (returns the first one)

Real syntax-aware parsing lands in 0.2.0.

## API

```ts
import { extractArtifact } from '@playgenx/parser';

const result = extractArtifact(raw);
if (result.ok) {
  console.log(result.kind, result.body);
} else {
  console.error(result.error.message, result.error.line);
}
```

### `extractArtifact(raw: string): ExtractResult`

Returns either:

```ts
{
  ok: true;
  kind: 'tsx' | 'html' | 'plain';
  body: string;
}
```

…or:

```ts
{ ok: false; error: { message: string; line?: number } }
```

## Examples

**Fenced tsx:**

````ts
extractArtifact('Intro.\n\n```tsx\nconst x = 1;\n```\n\nBye.');
// → { ok: true, kind: 'tsx', body: 'const x = 1;' }
````

**Unfenced code:**

```ts
extractArtifact('function add(a, b) { return a + b; }');
// → { ok: true, kind: 'tsx', body: 'function add(a, b) { return a + b; }' }
```

**Plain text:**

```ts
extractArtifact('Binary search finds an item in O(log n).');
// → { ok: true, kind: 'plain', body: 'Binary search finds an item in O(log n).' }
```

**Unbalanced fence:**

````ts
extractArtifact('```tsx\nconst x = 1;');
// → { ok: false, error: { message: 'Unbalanced code fence', line: 1 } }
````
