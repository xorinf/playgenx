---
tags: [retro, playgenx, pr-batch, 2026-07]
created: 2026-07-11
---

# PlayGenX PR-1..6 retrospective

Single-session batch that took `playgenx` from `v0.3.1` (LLM
pipeline only) to a full interactive-artifact stack. Eight
commits on `main`, twelve packages, 389 tests.

## Why

The user wanted:

1. **Interactive playground in the browser.** Started as a string
   parsed nowhere.
2. **Persistence that survives reloads.** Started as nothing.
3. **Multiple storage backends.** Started as nothing.
4. **Ship via npm.** Started as `playgenx@0.3.1` only.

We met 1, 2, 3 and have the code ready for 4. Step 4 needs an npm
org the user does not currently have (`@playgenx`).

## The eight commits

| PR  | Commit    | One-liner                                             |
| --- | --------- | ----------------------------------------------------- |
| 1   | `8c9dafc` | ArtifactStorage contract + LocalAdapter + HttpAdapter |
| 2   | `3d23d31` | Determinism fingerprints + NON_DETERMINISTIC_EXPR     |
| 3a  | `d7c1801` | Prop-shape schema + jsx-props extractor               |
| 3b  | `2fedbcf` | @playgenx/components (11 React 19 impls)              |
| 4   | `8a034b5` | @playgenx/renderer + Sandbox wiring                   |
| 5   | `ee9add8` | @playgenx/storage-react + LibraryPanel UI             |
| 6   | `d69f50f` | S3Adapter via @aws-sdk/client-s3                      |
| 6b  | `3d2c185` | pnpm-lock follow-up (SDK + @types/node)               |

Per-PR notes: see `docs/retros/pr1-storage.md`,
`docs/retros/pr2-fingerprint.md`, … `docs/retros/pr6-s3.md`.

## Test economy

| Layer                     | Tests added                        | After-batch total     |
| ------------------------- | ---------------------------------- | --------------------- |
| `@playgenx/storage`       | +30 (incl. 9 S3)                   | 30                    |
| `@playgenx/utils`         | +13 (non-det + sha256 + jsx-props) | 72                    |
| `@playgenx/validators`    | +15 (5 prop-shape + 5 determinism) | 57                    |
| `@playgenx/components`    | +39                                | 39                    |
| `@playgenx/renderer`      | +25                                | 25                    |
| `@playgenx/storage-react` | +10                                | 10                    |
| `playgenx` core           | +8 (fingerprint pinning)           | 49                    |
| **Net**                   | **+154**                           | **389** (12 packages) |

## What's not shipped

- **npm publish.** `@playgenx` org does not exist on npmjs. The
  user said the org will not exist "soon." All eight packages are
  publish-ready (dry-runs pass) but live on GitHub, not the
  registry.
- **Production hardening.** No CSP for the playground iframe, no
  integration tests against a real OpenAI key, no published
  rendering harness. Each PR was the smallest viable unit.
- **Obsidian import.** The Obsidian MCP timed out in this session
  so the user's vault was not updated. The notes in
  `docs/retros/` are the source of truth; bulk-import them later.

## Honest disagreements

- **Cloudinary / uploadthing** were rejected for PR 6 because
  uploadthing's React package was 10 months stale and Cloudinary
  is an image CDN, wrong tool for JSON bodies. Picked S3.
- **Hand-rolled Chart** in `@playgenx/components` rejected the
  recharts/visx dependency cost (~80KB). Bar/line/pie in
  ~50KB of hand-rolled SVG.
- **No Babel** in `@playgenx/renderer`. Babel would add ~700KB to
  the runtime iframe; a hand-rolled parser covers the artifact
  surface for ~13KB gzipped.
- **`MockProvider` echo body** triggers the new NON_DETERMINISTIC_EXPR
  check because `self-contained` contains `self`. Fixed by
  tightening the word-boundary check to treat `-` as a separator.

## What's good

- 12 packages, 389 tests, 0 failures across the whole workspace
  before and after every commit in this batch.
- Every commit green-lit lint + tests + build at the time of
  landing.
- Each PR was independently testable, independently revertable.
- The storage adapter contract is the right abstraction: PR 6's
  S3 adapter is a 200-line drop-in next to LocalAdapter.
