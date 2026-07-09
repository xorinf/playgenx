# Roadmap

This is the honest version. Items are sequenced by what unblocks the
most users.

## 0.1.0 (this release) — MVP

- ✅ Public SDK entry point: `playgenx`.
- ✅ `generatePlayground(request, options)` with the full pipeline
  (prompt → provider → parse → validate).
- ✅ One real provider: OpenAI. No SDK dep, raw `fetch`.
- ✅ One offline provider: MockProvider.
- ✅ `@playgenx/parser` — extract code blocks from LLM output.
- ✅ `@playgenx/validators` — substring + tag balance + registry
  membership.
- ✅ `@playgenx/registry` — `createRegistry`, `DEFAULT_REGISTRY`,
  `BUILT_IN_TAGS`.
- ✅ Per-package READMEs + `docs/reference/api.md`.
- ✅ `apps/playground` — Vite + React dev UI.
- ✅ CI (GitHub Actions: lint + build + test).
- ✅ release-please for automated version bumps.
- ✅ Dependabot for `npm` and `github-actions`.
- ✅ `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  `CHANGELOG.md`.

## 0.1.1 — Quick wins

- More `kind`s wired end-to-end: `poll`, `quiz`, `simulation`.
- More prompt templates.
- npm publish automation (currently requires `NPM_TOKEN` secret to be
  set; the workflow is in place).

## 0.2.0 — Real validation, real renderer

- Real AST-based validation in `@playgenx/validators` (likely
  `@babel/parser` or `acorn`).
- Real JSX renderer in `apps/playground` (mount validated components
  instead of showing source in an iframe).
- Streaming responses from providers.
- More providers: Anthropic, Gemini, Ollama.

## 0.3.0 — Docs site, multi-turn

- VitePress docs site (replacing the hand-written `docs/` folder, which
  becomes the source).
- Multi-turn / conversational support.
- Source-typed prompts (replace string concatenation with template
  functions).
- Real SSR / server-rendered examples (Next.js, Astro).

## What we deliberately are NOT doing

- **A web IDE** for editing prompts and components. There are good
  ones out there; we link to them in the docs.
- **A marketplace of components.** The registry is yours to define.
- **An LLM proxy service.** PlayGenX is a library, not a hosted
  product.
- **Auto-fixing bad LLM output.** When the validator rejects a body,
  we surface the error. We do not silently retry with a different
  prompt.

## How to influence the roadmap

- Open an issue with a use case. "I want to do X" is the most useful
  kind.
- Open a PR. Smaller PRs merge faster.
- Read the [FAQ](./faq.md) and the [security guide](./guides/security.md)
  before opening a security-related issue.
