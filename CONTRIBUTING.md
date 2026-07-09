# Contributing to PlayGenX

Thanks for your interest in contributing. PlayGenX is a small, friendly
TypeScript monorepo. The bar to contribute is intentionally low: open an
issue, open a PR, be kind in review.

## Development setup

You'll need **Node 22+** and **pnpm 9+**.

```sh
git clone https://github.com/xorinf/playgenx
cd playgenx
pnpm install
pnpm run verify   # lint + build + test
```

The verify step runs across all 8 packages. It should pass on a fresh
checkout.

## Project layout

```
packages/
  core/        public SDK entry — re-exports everything
  parser/      LLM response → kinded body
  validators/  substring + tag balance + allowlist
  registry/    component allowlist
  prompts/     prompt templates
  providers/   MockProvider + OpenAIProvider
  utils/       small shared helpers
  types/       shared TS interfaces
apps/
  playground/  Vite + React dev UI
docs/          hand-written markdown
examples/      runnable scripts
```

## Running tests

```sh
pnpm test                        # all packages
pnpm --filter @playgenx/core test  # one package
pnpm --filter @playgenx/core run test:watch  # one package, watch
```

## Coding style

- TypeScript strict, no `any` unless you've earned it.
- ESM only — no `require()`.
- Run `pnpm run format` (Prettier) before committing.
- New public API goes through `@playgenx/core`'s barrel.
- Each package keeps its own tests. Aim for 100% coverage on the public
  surface.

## Pull request process

1. Fork & branch from `main`.
2. Make your change. Add tests. Run `pnpm run verify` until it's green.
3. Open a PR against `main`.
4. The CI workflow (`.github/workflows/ci.yml`) must pass.
5. A maintainer will review within a few days.

If your change is more than cosmetic, please open an issue first to discuss
the design. Smaller PRs merge faster.

## Adding a new provider

1. Implement `Provider` from `@playgenx/types`.
2. Add a new file in `packages/providers/src/<name>.ts`.
3. Add tests in `packages/providers/src/<name>.test.ts`.
4. Re-export from `packages/providers/src/index.ts`.
5. Re-export from `packages/core/src/index.ts`.
6. Add a `README.md` section under "Providers".
7. Add an example in `examples/`.

## Adding a new artifact kind

1. Add the kind to the `ArtifactKind` union in `@playgenx/types`.
2. Add a prompt template in `@playgenx/prompts` (`src/<kind>.ts`).
3. Add a `generate<Kind>` function in `@playgenx/core` (mirror
   `generatePlayground`).
4. Re-export from `@playgenx/core`'s barrel.
5. Add tests for the prompt + the new function.
6. Update the README and docs.

## Reporting bugs

Open a GitHub issue with:

- What you did (steps to reproduce)
- What you expected
- What happened
- SDK version (`pnpm ls @playgenx/core`)

## Security issues

See [SECURITY.md](./SECURITY.md). Do **not** open a public issue for
vulnerabilities.

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). TL;DR: be kind, assume
good faith, no harassment.
