import { stripStrings } from './strip-strings.js';

/**
 * Naively check whether JSX-style tags in `body` are balanced.
 *
 * This is a deliberately weak check intended for v0.2.x. It counts
 * `<Tag` opens vs `</Tag` closes (case-insensitive) and ignores
 * self-closing `<Tag />`. It handles:
 *
 * - line and block comments (stripped before counting)
 * - string literals (contents stripped, including attribute values via
 *   the quote-state machine below)
 * - self-closing tags with simple attribute values (e.g. `<Foo bar="x" />`)
 * - self-closing tags with attribute values containing `<` and `>`
 *   (e.g. `<Foo bar="<x>" />`) — handled heuristically
 * - HTML void elements (br, hr, img, input, etc.) — never have closing tags
 *
 * It will still get fooled by:
 * - TypeScript generics like `<T>(x: T) => T` (counts `<T>` as a tag)
 * - arrow functions with `<T>(...)` syntax
 * - regex literals that span lines
 * - tags inside template literal interpolations like `${ <Foo /> }`
 *
 * For real syntax-aware balancing, wire in a parser in 0.3.0.
 */
export function hasBalancedTags(body: string): boolean {
  // 1. Strip string-literal contents so `<` and `>` inside strings don't
  //    count. This handles JS string literals, single/double-quoted,
  //    and template literals (without `${...}` parsing for v0.2.x).
  // 2. Strip line and block comments. Replace each comment char with a
  //    space so line numbers stay stable in error messages.
  const cleaned = stripStrings(
    body
      .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')),
  );

  // 3. Strip self-closing tags, including those with attribute values
  //    that contain `<` or `>`.
  const final = stripSelfClosingTags(cleaned);

  // 4. Count opens and closes.
  const opens = (final.match(/<[A-Za-z][A-Za-z0-9]*\b/g) ?? []).length;
  const closes = (final.match(/<\/[A-Za-z][A-Za-z0-9]*\s*>/g) ?? []).length;

  return opens === closes;
}

/**
 * HTML void elements — these never have closing tags. When we see an
 * opening tag for one of these, we don't expect a matching close.
 */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Replace every self-closing tag (`<Tag ... />`) with spaces, so it
 * doesn't count as an open or a close.
 *
 * Supports attribute values containing `<`, `>`, and quotes, e.g.:
 *   <Foo bar="x" />
 *   <Foo bar='x < y' />
 *   <Foo bar="a > b" />
 *   <Foo bar="a" baz='c' />
 *
 * Implementation: a small state machine walks the input, looking for
 * `<Tag...` followed by `>`. While inside the tag, we track quote state
 * to skip over attribute values. The tag is self-closing if the `>`
 * is immediately preceded by `/` (with optional whitespace).
 */
function stripSelfClosingTags(input: string): string {
  let out = '';
  let i = 0;
  const n = input.length;

  while (i < n) {
    // Find next `<` (or end of input).
    if (input.charCodeAt(i) !== 60 /* < */) {
      out += input[i] ?? '';
      i++;
      continue;
    }

    // Found `<` at position i. Check if it could be a tag start.
    // A tag starts with `<[A-Za-z]` (per our `opens` regex).
    if (i + 1 >= n) {
      out += input[i] ?? '';
      i++;
      continue;
    }
    const next = input.charCodeAt(i + 1);
    const isTagStart =
      (next >= 65 && next <= 90) || (next >= 97 && next <= 122);
    if (!isTagStart) {
      // Could be `</Tag` (closing) or `<<` or `<3` etc. Keep going.
      out += input[i] ?? '';
      i++;
      continue;
    }

    // Walk through the tag. Track quote state. Find the `>` or `/>`.
    let j = i + 1;
    let quote: string | null = null; // '"' | "'" | null
    let selfClosing = false;
    while (j < n) {
      const c = input.charCodeAt(j);
      if (quote !== null) {
        if (c === quote.charCodeAt(0)) {
          // End of quoted attribute value (no escape handling — TSX/JSX
          // uses single-line attributes, escape sequences in JS aren't
          // relevant inside attribute values for our purposes).
          quote = null;
        }
        j++;
        continue;
      }
      if (c === 34 /* " */ || c === 39 /* ' */) {
        quote = String.fromCharCode(c);
        j++;
        continue;
      }
      if (c === 62 /* > */) {
        // End of tag.
        break;
      }
      j++;
    }
    if (j >= n) {
      // Unterminated tag — bail and return the rest as-is.
      out += input.slice(i);
      return out;
    }
    // Check if the tag is self-closing: char before `>` should be `/`.
    // Allow whitespace between `/` and `>`.
    let k = j - 1;
    while (k > i && (input.charCodeAt(k) === 32 /* space */ || input.charCodeAt(k) === 9 /* tab */)) k--;
    if (k > i && input.charCodeAt(k) === 47 /* / */) {
      selfClosing = true;
    }
    if (selfClosing) {
      // Replace the entire `<Tag ... />` (inclusive) with spaces so
      // line numbers are preserved. We pad to the same length.
      out += ' '.repeat(j - i + 1);
      i = j + 1;
      continue;
    }
    // Not self-closing. Check if it's a void element — if so, treat it
    // like self-closing for counting purposes.
    // Read the tag name to check if it's a void element.
    let tagNameEnd = i + 1;
    while (tagNameEnd < n) {
      const cc = input.charCodeAt(tagNameEnd);
      if (!((cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || (cc >= 48 && cc <= 57))) {
        break;
      }
      tagNameEnd++;
    }
    const tagName = input.slice(i + 1, tagNameEnd).toLowerCase();
    if (VOID_ELEMENTS.has(tagName)) {
      // Treat void elements as self-closing for balance counting.
      out += ' '.repeat(j - i + 1);
      i = j + 1;
      continue;
    }
    // Regular opening tag — keep it in the output.
    out += input.slice(i, j + 1);
    i = j + 1;
  }
  return out;
}