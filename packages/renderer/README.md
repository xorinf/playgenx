# `@playgenx/renderer`

Parse a TSX/HTML artifact body into a normalised tree and render it against a registry of React 19 components. The bridge between the SDK pipeline and the playground iframe.

## Why

The SDK produces an `Artifact` whose body is a string of TSX-like markup referencing components in `DEFAULT_REGISTRY`. This package turns that string into a live React tree without `eval`, `new Function`, or any other runtime-execution sink.

## Install

```sh
pnpm add @playgenx/renderer @playgenx/components @playgenx/registry react react-dom
```

React 19 is a peer dependency; this package does not bundle it.

## Use

```tsx
import { renderBody } from '@playgenx/renderer';
import { componentMap } from '@playgenx/components';

const body = '<Card title="x"><Heading>Hello</Heading></Card>';

function Preview() {
  return <div>{renderBody(body, componentMap)}</div>;
}
```

Or, if you want the parsed AST instead of a React tree:

```ts
import { parseBodyNodes } from '@playgenx/renderer';
const nodes = parseBodyNodes('<Button label="Go" />');
// nodes: RendererElement[] | RendererText[] | RendererFallthrough[]
```

## What it supports

- PascalCase tags (matched against the `componentMap` you supply)
- Lowercase built-in HTML tags (passed straight through as React intrinsic elements)
- Self-closing tags (`<Foo />`)
- Open/close pairs with nested children
- String-literal attribute values: `<Foo label="hello" />`
- Expression attribute values: `<Foo value={x} />`
- Boolean shorthand: `<Foo disabled />`
- Comments and string contents preserved during normalisation

## What it doesn't support

- Arbitrary JSX expressions on child positions (the parser preserves text but doesn't evaluate `{cond ? a : b}`)
- Fragment shorthand `<>...</>`
- Member-expressions like `<Foo.Bar />`
- Spaceship and slice expressions in attribute values

Bodies that hit these regions produce a {@link RendererFallthrough} node whose `value` carries the original source so the host can surface it as a `<pre>` for debugging.

## Determinism

The renderer never calls `eval`, `new Function`, or any user-supplied callback. Expression values are forwarded to React as inert placeholder objects (`RenderExpression`) whose `toString()` returns the source text. Combined with `NON_DETERMINISTIC_EXPR` (PR 2) rejection in the validator, this means a mounted artifact is byte-stable across rerenders with the same body.

## Versioning

This package follows PlayGenX's overall version policy (mirror `playgenx` core).

## License

MIT — see [LICENSE](../../LICENSE).
