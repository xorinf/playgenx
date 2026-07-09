# Security

## Reporting a vulnerability

If you discover a security vulnerability in PlayGenX, please email
**security@xorinf.dev** with a description of the issue and steps to
reproduce. We will acknowledge receipt within 48 hours and aim to publish
a fix within 90 days, coordinated with the reporter.

**Please do not** open a public GitHub issue for security vulnerabilities.

## Scope

In scope:

- `@playgenx/*` packages.
- The `apps/playground` dev app.
- The CI/release pipeline in this repository.

Out of scope:

- Issues in third-party packages we depend on (file with upstream).
- The `apps/playground` app's reliance on `VITE_OPENAI_API_KEY` being
  shipped to the browser — this is **documented as a local-dev-only
  pattern**. Do not deploy the playground to a public host; it's not a
  product, it's a developer tool.

## Trust model

PlayGenX generates *content*. The validator checks content for
clearly-forbidden constructs and unknown component names. It is **not** a
security boundary against a determined attacker. For untrusted input,
treat validator-passing output as untrusted and render it in a sandboxed
context (the playground does this with a `sandbox="allow-scripts"`
iframe).

## Disclosure policy

We follow a 90-day coordinated disclosure timeline:

1. Day 0 — vulnerability reported.
2. Day 1–2 — acknowledgement.
3. Day 1–89 — investigation, fix, regression tests.
4. Day 90 — public disclosure + release of patched version.
