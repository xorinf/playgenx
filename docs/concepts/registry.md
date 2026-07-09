# Registry

The registry is the component allowlist. The validator uses it to decide
which JSX tags are allowed in a generated body.

## Why

LLMs will invent components if you let them. You want a tight, explicit
allowlist so generated artifacts stay predictable and safe to render.
The registry is that allowlist.

## The interface

```ts
interface Registry {
  isAllowed(name: string): boolean;
  list(): readonly string[];
  add(name: string): void;
}
```

## `DEFAULT_REGISTRY`

Shipped in `@playgenx/registry`. The v0.1.0 set:

```
Button, TextField, Slider, Chart, Container, Code, Heading, Text, Stepper, Card, List
```

## `BUILT_IN_TAGS`

Lowercase HTML tags the validator always allows (no registry membership
required):

```
div, span, p, h1, h2, h3, h4, h5, h6, ul, ol, li, code, pre, button,
input, label, br, hr, section, article, main, header, footer, nav
```

## Using the default

```ts
import { generatePlayground, OpenAIProvider } from '@playgenx/core';

await generatePlayground(req, { provider: new OpenAIProvider() });
// Uses DEFAULT_REGISTRY under the hood.
```

## Custom registry

```ts
import { createRegistry, generatePlayground, OpenAIProvider } from '@playgenx/core';

const mine = createRegistry(['Button', 'Slider', 'MyCustomWidget']);

await generatePlayground(req, {
  provider: new OpenAIProvider(),
  registry: mine,
});
```

## Building a registry from your own component set

If you have a typed component library, build a registry from it:

```ts
import { createRegistry } from '@playgenx/registry';
import { MyButton, MySlider, MyChart } from './components.js';

export const myRegistry = createRegistry([
  MyButton.displayName ?? 'MyButton',
  MySlider.displayName ?? 'MySlider',
  MyChart.displayName ?? 'MyChart',
]);
```

## Limitations

- The registry is a string-name allowlist. It does not understand JSX
  scope, props, or imports.
- It is **not** a security boundary. Render validator-passing bodies in
  a sandboxed context (the playground does this with an iframe).
