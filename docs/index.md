# PlayGenX documentation

Welcome. This is the user manual for the PlayGenX SDK — a small,
opinionated TypeScript library for turning lecture context into
interactive educational artifacts using LLMs.

## Where to start

- **[Getting started](./getting-started.md)** — install + 60-second
  quickstart.
- **[API reference](./reference/api.md)** — every exported symbol.
- **[Roadmap](./roadmap.md)** — what we built, what's next, what we
  deliberately didn't.

## Concepts

Read these to understand _why_ the SDK is shaped the way it is.

- **[Pipeline](./concepts/pipeline.md)** — what happens between
  `generatePlayground(req, opts)` and the result you get back.
- **[Providers](./concepts/providers.md)** — what a Provider is and how to
  add your own.
- **[Registry](./concepts/registry.md)** — the component allowlist.
- **[Validation](./concepts/validation.md)** — what we check, what we
  don't, and why.

## Guides

Task-oriented how-tos.

- **[OpenAI setup](./guides/openai.md)** — get an OpenAI key and run the
  playground.
- **[Custom provider](./guides/custom-provider.md)** — 20-line example
  that wraps a different LLM.
- **[Custom validator](./guides/custom-validator.md)** — plug in your own
  AST-based check.
- **[Security](./guides/security.md)** — trust model, sandboxing, when
  to run server-side.

## Reference

- **[API reference](./reference/api.md)** — every public symbol.
- **[FAQ](./faq.md)** — the top 8 questions we get.

## Project meta

- [Root README](../README.md) — landing page.
- [CONTRIBUTING](../CONTRIBUTING.md) — how to contribute.
- [SECURITY](../SECURITY.md) — how to report a vulnerability.
- [CHANGELOG](../CHANGELOG.md) — release history.

## Sessions & retros

- [PR-1..6 retrospective batch (2026-07)](retros/index.md) — single-session batch shipping
  ArtifactStorage, determinism, components, renderer, storage-react, and the S3 adapter.
