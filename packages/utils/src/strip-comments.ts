/**
 * Strip `// line` and `/* block *\/` comments from code, preserving newlines
 * so that line numbers in the result are roughly stable with the input.
 */
export function stripCodeComments(body: string): string {
  // Replace //...\n with the same number of newlines (so the line count holds).
  const noLineComments = body.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
  // Replace /* ... */ with spaces, preserving newlines.
  const noBlockComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, (m) =>
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
