---
tags: [retro, pr2, determinism]
pr: 2
commit: 3d23d31
---

# PR 2 — Determinism fingerprints + NON_DETERMINISTIC_EXPR

**What:** Added optional `id` (sha-256 of `kind|providerId|body`)
and `promptFingerprint` (sha-256 of `kind|context|concept|prompt`)
to `Artifact`. Added validator guard that rejects TSX bodies
referencing `Math`, `Date`, `window`, `globalThis`, `self`,
`process`, `crypto` at word boundaries.

**Why:** PR 1's storage layer keyed on `id`, but two consecutive
calls with the same input produced different `id`s because the
body drifted. The fix was two-part: deterministic body fingerprints
so the same input → same id, and a validator guard so a body
couldn't *contain* a non-deterministic expression that would
re-evaluate differently on each mount.

**Bugs caught and fixed during the PR:**

1. **`MockProvider` echo body** triggers the guard. The mock
   provider returns the prompt template text wrapped in a fence;
   the template contains the phrase "single self-contained". The
   `self` substring matched. Fix: tightened `isTokenBoundary` to
   treat `-` as a separator. Compounds like `self-contained` no
   longer false-positive; genuine JS `self.fetch(...)` still
   matches.

2. **`stripJsComments` vs `stripCodeComments`** — the prop-shape
   extraction needed comments stripped but strings preserved
   (otherwise `label="<Unknown />"` came through with `<Unknown`
   replaced by spaces). Wrote a new state-machine helper
   `stripJsComments` that mirrors `stripStrings` but doesn't
   touch string contents.

**Tests:** 35 new. 16 non-deterministic + 6 sha256 + 5 validator
+ 8 core fingerprint pinning.

**Bundle:** core dist grew from 17KB → 18KB gzipped. Validator
dist grew from 1.01KB → 1.01KB.

**Trade-off:** the validator rejects `self-contained` even as
plain text content inside a string literal — because the JS
parser sees the literal *before* the word boundary check
runs. String contents are masked by `stripJsComments`, but the
literal token `self` outside the string is still checked.
Verified via the new test cases.

**Next:** PR 3a turns the loose "name-only" registry into a
schema-bound registry, so the validator can catch prop-shape
errors on top of these identity checks.