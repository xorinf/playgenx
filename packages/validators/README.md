# @playgenx/validators

Lightweight validation for parsed artifact bodies. Pure functions — no IO.

## What it checks (v0.1.0)

In order — first failure is returned:

1. **No `eval(`** — anywhere, after comment-stripping.
2. **No `new Function(`** — case-insensitive, after comment-stripping.
3. **No `import`** or `require(`** — after comment-stripping.
4. **JSX tags roughly balanced** — naive open/close count.
5. **Every capitalized tag is in the registry or in the built-in safe set.**

## What it does NOT do (v0.1.0)

- No real AST parsing — substring checks can false-positive on strings
  containing `eval` etc. Comment-stripping helps, doesn't eliminate.
- No understanding of JSX scope, props, or imports.
- No sandboxing. A successful `validate()` is a green light, not a
  guarantee. Render artifacts in a sandboxed iframe.

Real AST-based validation lands in 0.2.0 (likely via `acorn` or
`@babel/parser`).

## API

```ts
import { validate } from '@playgenx/validators';
import { createRegistry } from '@playgenx/registry';

const result = validate(parsedBody); // uses DEFAULT_REGISTRY
const custom = validate(parsedBody, createRegistry(['Foo'])); // custom allowlist

if (result === null) {
  // safe to use
} else {
  console.error(result.message, `at line ${result.line}`);
}
```

## Trust model

PlayGenX is a generator of _content_. The validator checks content for
clearly-forbidden constructs and unknown component names. It is not a
security boundary against a determined attacker — for that, render
artifacts in a sandboxed context and treat the result as untrusted.
