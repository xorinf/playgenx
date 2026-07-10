/**
 * Replace the contents of string literals with spaces, preserving newlines
 * and quote characters so line numbers stay stable.
 *
 * Handles:
 * - single-quoted and double-quoted strings (with backslash escapes)
 * - template literals WITHOUT interpolation (looks for the closing backtick)
 * - template literals WITH `${...}` interpolation (recursively processes the
 *   interpolated expression so JSX tags inside `${ <Foo /> }` don't fool
 *   downstream tag-balancers)
 *
 * Used by {@link stripCodeComments}, {@link tagNames}, and
 * {@link hasBalancedTags} so the substring/tag-balance checks don't false
 * -positive on characters inside strings.
 */
export function stripStrings(input: string): string {
  let out = '';
  let i = 0;
  const n = input.length;
  while (i < n) {
    const c = input.charCodeAt(i);

    // Template literal: handle `${...}` interpolation by recursing into
    // the interpolated expression so any JSX inside is also "stringified"
    // (i.e., its tag markers are replaced with spaces). The default case
    // (no interpolation) just walks to the next backtick.
    if (c === 96 /* ` */) {
      out += '`';
      i++;
      while (i < n) {
        const cc = input.charCodeAt(i);
        // End of template literal.
        if (cc === 96) {
          out += '`';
          i++;
          break;
        }
        // Interpolation: scan past the `${`, recursively strip the inner
        // expression (which may itself contain strings, template literals,
        // or tags), then consume the closing `}`.
        if (cc === 36 /* $ */ && i + 1 < n && input.charCodeAt(i + 1) === 123 /* { */) {
          out += '$\x7B'; // preserve "${" visually for line-number stability
          i += 2;
          // Recursively strip the interpolated expression. Find the matching
          // closing brace at the same nesting depth (braces inside the
          // interpolation may nest — e.g. `${ {a:1}.a }`).
          let depth = 1;
          const innerStart = i;
          while (i < n && depth > 0) {
            const ic = input.charCodeAt(i);
            if (ic === 123 /* { */) depth++;
            else if (ic === 125 /* } */) {
              depth--;
              if (depth === 0) break;
            }
            // Skip over nested strings/template-literals so their braces
            // don't change our depth count. Reuse stripStrings for this.
            else if (ic === 34 || ic === 39 || ic === 96) {
              const quote = ic;
              i++;
              while (i < n && input.charCodeAt(i) !== quote) {
                if (input.charCodeAt(i) === 92 /* \ */) i++; // skip escape
                i++;
              }
              // i is now at the closing quote (or n); the outer loop will
              // re-check at the top.
              continue;
            }
            i++;
          }
          const inner = input.slice(innerStart, i);
          out += stripStrings(inner);
          if (i < n && input.charCodeAt(i) === 125 /* } */) {
            out += '}';
            i++;
          }
          continue;
        }
        out += cc === 10 ? '\n' : ' ';
        i++;
      }
      continue;
    }

    if (c === 34 /* " */ || c === 39 /* ' */) {
      const quote = c;
      out += String.fromCharCode(c);
      i++;
      while (i < n) {
        const cc = input.charCodeAt(i);
        if (cc === 92 /* \ */ && i + 1 < n) {
          // Escape sequence: keep the next char (any char) and move on.
          out += (input[i] ?? '') + (input[i + 1] ?? '');
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

    out += input[i] ?? '';
    i++;
  }
  return out;
}