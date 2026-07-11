# `@playgenx/components`

Default React 19 implementations for every entry in `DEFAULT_REGISTRY`. Pair with `@playgenx/registry` and the parser/validator pipeline.

## Install

```sh
pnpm add @playgenx/components react@^19 react-dom@^19
```

React 19 is a peer dependency; this package does not bundle it.

## What's in here

11 components, each matching a name in `@playgenx/registry`:

- `Button` — primary / secondary / ghost variant, disabled state, click handler.
- `TextField` — labeled controlled-or-uncontrolled input.
- `Slider` — clamped range input with optional caption.
- `Chart` — bar / line / pie, hand-rolled SVG, no chart library.
- `Container` — vertical flex wrapper with padding + gap.
- `Code` — inline or `<pre><code>` formatting, language data-attribute.
- `Heading` — `<h1>`..`<h6>` with size-by-level, clamped.
- `Text` — `<p>` with weight, size, color.
- `Stepper` — multi-step reveal with previous/current/future states.
- `Card` — bordered + shadowed wrapper with elevation prop.
- `List` — `<ul>` or `<ol>` from an array of arbitrary values.

## Use

```tsx
import { Button, Container, Heading, Text, componentMap } from '@playgenx/components';
import { DEFAULT_REGISTRY, findSchema } from '@playgenx/registry';

function App() {
  return (
    <Container>
      <Heading level={2}>Hello</Heading>
      <Text>A short description.</Text>
      <Button label="Continue" variant="primary" />
    </Container>
  );
}

// Render-time lookup:
const HeadingC = componentMap['Heading'];
return <HeadingC level={2}>title</HeadingC>;
```

## Determinism

Components are render-only and **never** reference `Math.random`, `Date.now`, or runtime-crypto APIs. Hashing inputs (validation, storage) is fully reproducible — `<Chart kind="bar" data={...} />` renders the same SVG every time given the same data.

If you mount these in an environment where a renderer may pass non-deterministic callbacks, run inside a sandboxed iframe that the LLM never controls.

## Versioning

This package follows PlayGenX's overall version policy (mirror `playgenx` core). A component's prop signature is part of the public contract; new optional props are non-breaking, removing/renaming is a breaking change.

## License

MIT — see [LICENSE](../../LICENSE).
