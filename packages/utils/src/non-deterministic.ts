/**
 * Detect non-deterministic expressions in an artifact body.
 *
 * An artifact body should be safe to render the same way twice — same
 * input, same output, every time. References to runtime-evaluated
 * globals (`Math`, `Date`, `window`, ...) make that impossible: their
 * values depend on the moment of evaluation or on the runtime
 * environment.
 *
 * Returns the FIRST forbidden token found in `body`, or `null` if
 * none. Strings and comments are assumed to already be stripped by
 * the caller (see `stripCodeComments` in @playgenx/utils).
 *
 * Forbidden tokens (matched as whole-word OR as the prefix of an
 * accessor expression `Token.something`):
 *
 *  - `Math`         — `Math.random` is the worst offender; `Math.PI`
 *                      is actually deterministic but the bare
 *                      identifier still signals intent to use the
 *                      math global. Allow via custom registry if you
 *                      accept the risk.
 *  - `Date`         — `new Date()` and `Date.now()` drift.
 *  - `window`       — environment-coupled global; varies across
 *                      browser/Node/jsdom.
 *  - `globalThis`   — same as `window` for cross-platform concerns.
 *  - `self`         — same, with a focus on worker context.
 *  - `process`      — Node-only; unavailable in iframes.
 *  - `crypto`       — `randomUUID` / `getRandomValues` are
 *                      random; allow only if you also pin a seed.
 *
 * The list is intentionally tight. Add to it as new non-determinism
 * vectors appear. Once a token is forbidden, expect the playground
 * prompt to also drop it from its suggestion list.
 */

const FORBIDDEN = [
  'Math',
  'Date',
  'window',
  'globalThis',
  'self',
  'process',
  'crypto',
] as const;

/**
 * Scan `body` for forbidden tokens. Returns the first one (in the
 * order of `FORBIDDEN`) that appears as either:
 *   - a whole word matching /^[A-Za-z]+$/ (with the same case)
 *   - the prefix of a member-access expression `<word>.<member>`
 *
 * Substring matches inside longer identifiers (e.g. `match`, `update`)
 * are correctly NOT matched. The check relies on `body` having
 * comments and string literals already stripped.
 */
export function findNonDeterministic(body: string): string | null {
  for (const token of FORBIDDEN) {
    let idx = 0;
    while ((idx = body.indexOf(token, idx)) >= 0) {
      if (isTokenBoundary(body, idx, token.length)) {
        // Confirm it's the prefix of an identifier or accessor —
        // which means the character right after must be either
        // end-of-string, whitespace, or punctuation, and the
        // character right before must be the same.
        return token;
      }
      idx += token.length;
    }
  }
  return null;
}

function isTokenBoundary(body: string, idx: number, len: number): boolean {
  const before = idx === 0 ? '' : body[idx - 1] ?? '';
  const after = body[idx + len] ?? '';
  // Word boundary: not preceded or followed by an alphanumeric char.
  // We deliberately treat `-` as a boundary too so that English
  // compound words (e.g. `self-contained`, `Math-related`) don't
  // false-positive as identifiers.
  return !isIdentChar(before) && !isIdentChar(after) && !isBoundaryChar(before) && !isBoundaryChar(after);
}

function isIdentChar(c: string): boolean {
  if (!c) return false;
  const code = c.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 || // _
    code === 36 // $
  );
}

function isBoundaryChar(c: string): boolean {
  if (!c) return false;
  // `-` is treated as a word boundary so `self-contained` doesn't
  // false-match `self`. Other punctuation is ignored: `.`
  //   belongs to identifier-like continuations (e.g. `Math.PI`),
  // `<` `>` are tag boundaries (a tag `<Math>` is caught by the
  // registry check, not here), `/` is part of expressions like
  // `getSelf()`. Keeping this list intentionally small keeps the
  // matching predictable.
  return c === '-';
}
