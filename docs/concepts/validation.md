# Validation

The validator checks a parsed body for safety and component membership.

## What it checks (v0.1.0)

In order — first failure is returned:

1. **No `eval(`** — anywhere, after comment-stripping.
2. **No `new Function(`** — case-insensitive, after comment-stripping.
3. **No `import`** or `require(`** — after comment-stripping.
4. **JSX tags roughly balanced** — naive open/close count.
5. **Every capitalized tag is in the registry or the built-in safe set.**

## What it does NOT do (v0.1.0)

- No real AST parsing — substring checks can false-positive on strings
  containing `eval`. Comment-stripping helps, doesn't eliminate.
- No understanding of JSX scope, props, or imports.
- No sandboxing. A successful `validate()` is a green light, not a
  guarantee.

Real AST-based validation lands in 0.2.0 (likely via `acorn` or
`@babel/parser`).

## Plugging in your own validator

`generatePlayground` accepts a `validate` option:

```ts
import { generatePlayground, OpenAIProvider } from 'playgenx';

const result = await generatePlayground(req, {
  provider: new OpenAIProvider(),
  validate: (body) => {
    if (body.includes('forbidden-phrase')) return 'contains a forbidden phrase';
    return null;
  },
});
```

The return value is:

- `null` — pass.
- a `string` — fail with that message.

You can compose with the built-in:

```ts
import { validate, createRegistry, generatePlayground, OpenAIProvider } from 'playgenx';

const strict = createRegistry(['Button', 'Slider']);

await generatePlayground(req, {
  provider: new OpenAIProvider(),
  registry: strict,
  validate: (body) => validate(body, strict)?.message ?? null,
});
```

## Trust model

PlayGenX is a *content generator*. The validator checks content for
clearly-forbidden constructs and unknown component names. It is **not** a
security boundary against a determined attacker. For untrusted input,
render validator-passing output in a sandboxed context.

The playground app does this with `<iframe sandbox="allow-scripts">`.
