import { stripStrings } from './strip-strings.js';

/**
 * Strip `// line` and `/* block *\/` comments AND the contents of
 * string literals, preserving newlines so that line numbers in the
 * result are roughly stable with the input.
 *
 * String-literal contents are stripped because substring checks for
 * `eval`, `import`, etc. would otherwise false-positive on the
 * characters inside strings. We preserve the quote characters themselves
 * so line numbers stay stable.
 */
export function stripCodeComments(body: string): string {
  // Strip strings first so // inside "..." doesn't look like a comment.
  const noStrings = stripStrings(body);
  // Replace //...\n with the same number of newlines (so the line count holds).
  const noLineComments = noStrings.replace(/\/\/[^\n]*/g, (m: string) =>
    m.replace(/[^\n]/g, ' '),
  );
  // Replace /* ... */ with spaces, preserving newlines.
  const noBlockComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m: string) =>
    m.replace(/[^\n]/g, ' '),
  );
  return noBlockComments;
}

/**
 * Strip JS-style `// line` and `/* block *\/` comments from a body of
 * source code, preserving the contents of string literals and template
 * literals exactly. Unlike {@link stripCodeComments}, this function
 * does NOT mask string contents — callers that need to *read* string
 * values (e.g. `propsOfTag`) get them back unchanged.
 *
 * Implementation: walk the body character-by-character. Track whether
 * we're inside a string or comment; only delete characters that are
 * inside comments. We must handle:
 *  - `// ...` until newline (any quote state cancels the comment)
 *  - `/* ... *\/` (any quote state cancels the comment)
 *  - `"..."`  `'...'`  with backslash escapes
 *  - `` `...${...}...` `` with nested interpolation
 *  - line-number stability: deleted chars are replaced with spaces
 */
export function stripJsComments(body: string): string {
  let out = '';
  let i = 0;
  const n = body.length;
  while (i < n) {
    const c = body.charCodeAt(i);

    // Start of `//` line comment.
    if (c === 47 /* / */ && body.charCodeAt(i + 1) === 47 /* / */) {
      out += '  ';
      i += 2;
      while (i < n) {
        const cc = body.charCodeAt(i);
        out += cc === 10 /* \n */ ? '\n' : ' ';
        if (cc === 10 /* \n */) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Start of `/* ... */` block comment.
    if (c === 47 /* / */ && body.charCodeAt(i + 1) === 42 /* * */) {
      out += '  ';
      i += 2;
      while (i < n) {
        const cc = body.charCodeAt(i);
        if (cc === 42 /* * */ && body.charCodeAt(i + 1) === 47 /* / */) {
          out += '  ';
          i += 2;
          break;
        }
        out += cc === 10 ? '\n' : ' ';
        i++;
      }
      continue;
    }

    // Template literal `` `...${...}...` ``
    if (c === 96 /* ` */) {
      out += '`';
      i++;
      while (i < n) {
        const cc = body.charCodeAt(i);
        if (cc === 96) {
          out += '`';
          i++;
          break;
        }
        if (cc === 92 /* \ */ && i + 1 < n) {
          out += body[i] ?? '';
          out += body[i + 1] ?? '';
          i += 2;
          continue;
        }
        // ${ ... } interpolation: recurse so nested strings/comments
        // inside the expression are also handled correctly.
        if (cc === 36 /* $ */ && body.charCodeAt(i + 1) === 123 /* { */) {
          out += '${';
          i += 2;
          let depth = 1;
          const innerStart = i;
          while (i < n && depth > 0) {
            const ic = body.charCodeAt(i);
            if (ic === 123) depth++;
            else if (ic === 125 /* } */) {
              depth--;
              if (depth === 0) break;
            }
            // Skip over string/template-literal contents so they
            // don't change depth.
            else if (ic === 34 || ic === 39 || ic === 96) {
              const q = ic;
              out += String.fromCharCode(q);
              i++;
              while (i < n && body.charCodeAt(i) !== q) {
                if (body.charCodeAt(i) === 92 && i + 1 < n) {
                  out += body[i] ?? '';
                  out += body[i + 1] ?? '';
                  i += 2;
                  continue;
                }
                out += body[i] ?? '';
                i++;
              }
              if (i < n) {
                out += String.fromCharCode(q);
                i++;
              }
              continue;
            }
            out += body[i] ?? '';
            i++;
          }
          // Inner was already written character-by-character. Close the `}`.
          if (i < n && body.charCodeAt(i) === 125) {
            out += '}';
            i++;
            void innerStart; // silence unused
          }
          continue;
        }
        out += body[i] ?? '';
        i++;
      }
      continue;
    }

    // Single- or double-quoted string.
    if (c === 34 /* " */ || c === 39 /* ' */) {
      const q = c;
      out += String.fromCharCode(q);
      i++;
      while (i < n) {
        const cc = body.charCodeAt(i);
        if (cc === 92 /* \ */ && i + 1 < n) {
          out += body[i] ?? '';
          out += body[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (cc === q) {
          out += String.fromCharCode(cc);
          i++;
          break;
        }
        out += body[i] ?? '';
        i++;
      }
      continue;
    }

    // Anything else: copy verbatim.
    out += body[i] ?? '';
    i++;
  }
  return out;
}

/**
 * Find the 1-indexed line number of the first occurrence of `needle` in `text`.
 * Returns undefined if not found.
 */
export function lineOfFirst(text: string, needle: string): number | undefined {
  const idx = text.indexOf(needle);
  if (idx < 0) return undefined;
  let line = 1;
  for (let i = 0; i < idx; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}