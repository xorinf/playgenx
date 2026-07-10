import { stripCodeComments } from './strip-comments.js';

/**
 * Extract the capitalized JSX-style tag names from a body of code,
 * ignoring tags that appear inside comments or string literals.
 *
 * For the validator's "unknown component" check, we want to find all
 * tags that would actually be rendered, not tags that are inside
 * strings or comments. So we strip both before searching.
 *
 * @example
 * tagNames('<Card><Text>hi</Text></Card>') // → ['Card', 'Text']
 * tagNames('const s = "<Button>"; <RealWidget />') // → ['RealWidget']
 */
export function tagNames(body: string): string[] {
  // Strip comments and strings in one pass via a small state machine
  // would be ideal, but for v0.2.x we use the existing helpers: comment
  // stripping is robust; for strings we use a single-pass scan that
  // replaces string contents with spaces (similar to the approach in
  // balanced-tags but inline for performance).
  const cleaned = stripStringsAndComments(body);
  const re = /<([A-Z][A-Za-z0-9]*)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m[1]) seen.add(m[1]);
  }
  return Array.from(seen);
}

/**
 * Replace comment and string-literal contents with spaces, preserving
 * newlines and quote characters so line numbers stay stable.
 */
function stripStringsAndComments(input: string): string {
  // First, strip comments using the existing helper.
  const s = stripCodeComments(input);

  // Then strip string contents.
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 96 /* ` */) {
      out += '`';
      i++;
      while (i < n) {
        if (s.charCodeAt(i) === 96) {
          out += '`';
          i++;
          break;
        }
        out += s.charCodeAt(i) === 10 ? '\n' : ' ';
        i++;
      }
      continue;
    }
    if (c === 34 /* " */ || c === 39 /* ' */) {
      const quote = c;
      out += String.fromCharCode(c);
      i++;
      while (i < n) {
        const cc = s.charCodeAt(i);
        if (cc === 92 /* \ */ && i + 1 < n) {
          out += s[i] + s[i + 1];
          i += 2;
          continue;
        }
        if (cc === quote) {
          out += String.fromCharCode(cc);
          i++;
          break;
        }
        out += cc === 10 ? '\n' : ' ';
        i++;
      }
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}