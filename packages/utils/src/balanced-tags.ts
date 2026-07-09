/**
 * Naively check whether JSX/HTML-style tags in `body` are balanced.
 *
 * This is a *deliberately weak* check intended for v0.1.0 — it counts
 * `<Tag` opens vs `</Tag` closes (case-insensitive) and ignores
 * self-closing `<Tag />` and void elements. It will get fooled by:
 *
 * - tag names inside strings or comments
 * - arrow functions containing `<` in TS
 * - regex literals containing `<` and `/>`
 *
 * For real syntax-aware balancing, wire in a parser in 0.2.0.
 */
export function hasBalancedTags(body: string): boolean {
  // Self-closing tags: <Tag ... /> — we don't count these on either side.
  // We strip them out of the body before counting opens vs closes.
  const cleaned = body
    .replace(/\/\/[^\n]*/g, '') // strip // line comments first
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip /* block */ comments
    .replace(/<[A-Za-z][A-Za-z0-9]*\b[^<>]*\/>/g, ''); // strip self-closing tags

  // Count opens and closes.
  const opens = (cleaned.match(/<[A-Za-z][A-Za-z0-9]*\b/g) ?? []).length;
  const closes = (cleaned.match(/<\/[A-Za-z][A-Za-z0-9]*\s*>/g) ?? []).length;

  return opens === closes;
}
