# @playgenx/registry

The component registry decides which JSX tags the validator will accept.

## Why

LLMs are happy to invent components. We want a tight, explicit allowlist so
generated artifacts stay predictable and safe to render. The registry is
that allowlist.

## What it is

- A `Registry` is a set of `ComponentName`s with `isAllowed`, `list`, `add`.
- `DEFAULT_REGISTRY` — the built-in component set:
  `Button, TextField, Slider, Chart, Container, Code, Heading, Text, Stepper, Card, List`
- `BUILT_IN_TAGS` — the lowercase HTML tags the validator always allows:
  `div, span, p, h1-h6, ul, ol, li, code, pre, button, input, label, br, hr,
section, article, main, header, footer, nav`

## API

```ts
import { createRegistry, DEFAULT_REGISTRY } from '@playgenx/registry';

const custom = createRegistry(['Button', 'MyWidget']);
custom.add('Chart');

custom.isAllowed('Chart'); // → true
custom.isAllowed('Unknown'); // → false

// Pass to the validator to scope what you accept:
// validate(body, custom)
```

## Limitations

The registry is a string-name allowlist. It does not understand JSX scope,
imports, or props. It's a first line of defense, not a security boundary.
