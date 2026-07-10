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