# Security

PlayGenX generates _content_. The validator checks content for
clearly-forbidden constructs and unknown component names. It is **not** a
security boundary against a determined attacker.

This page is about the trust model, what we check, what we don't, and
where you should put the actual safety boundary.

## What the validator does

In v0.1.0, the built-in validator checks, in order:

1. No `eval(`.
2. No `new Function(` (case-insensitive).
3. No `import` statements or `require(` calls.
4. JSX tags are roughly balanced.
5. Every capitalized tag is in the registry or the built-in safe set.

These are _defense in depth_, not a sandbox.

## What the validator does NOT do

- No real AST parsing — substring checks can false-positive on strings
  containing `eval` etc.
- No understanding of JSX scope, props, or imports.
- No sandboxing. A successful `validate()` is a green light, not a
  guarantee.

Real AST-based validation is on the [roadmap](../roadmap.md) for 0.2.0.

## Where to put the safety boundary

**Render validator-passing output in a sandboxed context.** The
playground app does this with `<iframe sandbox="allow-scripts">`. The
iframe can run JavaScript but cannot navigate the top frame, submit
forms, or read cookies. That's the actual safety boundary.

For untrusted input, the recommended pattern is:

```ts
import { generatePlayground, OpenAIProvider } from 'playgenx';

// 1. Generate on a server you control.
const result = await generatePlayground(req, {
  provider: new OpenAIProvider(),
});

// 2. Serve the body as a static string — never eval it.
// 3. The client renders it inside <iframe sandbox="allow-scripts">.
```

## API keys

- The `OpenAIProvider` reads `OPENAI_API_KEY` from the env lazily.
- **Do not** ship the playground app to a public host — the
  `VITE_OPENAI_API_KEY` is bundled into the JavaScript and visible to
  anyone who opens DevTools. The playground is a local-dev tool only.
- For production, call `OpenAIProvider` on a server and proxy the
  request through your own backend.

## Reporting a vulnerability

See [`SECURITY.md`](../../SECURITY.md). Email
**security@xorinf.dev**. We follow a 90-day coordinated disclosure
timeline.
