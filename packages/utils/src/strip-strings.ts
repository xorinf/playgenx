/**
 * Replace the contents of string literals with spaces, preserving newlines
 * and quote characters so line numbers stay stable.
 *
 * Handles single-quoted, double-quoted, and template-literal strings
 * (without interpolation for v0.2.x). Escape sequences in single/double
 * quoted strings (e.g. `\"`) are handled — we only end the string on an
 * unescaped quote of the same kind.
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

    // Template literal (no ${} handling — we just look for the closing
    // backtick).
    if (c === 96 /* ` */) {
      out += '`';
      i++;
      while (i < n) {
        if (input.charCodeAt(i) === 96) {
          out += '`';
          i++;
          break;
        }
        out += input.charCodeAt(i) === 10 ? '\n' : ' ';
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