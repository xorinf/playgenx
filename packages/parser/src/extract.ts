/**
 * Extracts a single code artifact from a raw LLM response.
 *
 * The extraction is deliberately conservative in v0.1.0: it understands
 * fenced code blocks (```tsx, ```html, ```jsx, untagged) and falls back to
 * shape-based detection for unfenced content. Real syntax-aware parsing
 * lands in 0.2.0.
 *
 * @packageDocumentation
 */

/** What kind of body we extracted. */
export type ExtractKind = 'tsx' | 'html' | 'plain';

/** Error from a failed extraction. */
export interface ParseError {
  /** Human-readable error message. */
  readonly message: string;
  /** 1-indexed line number where the failure was detected, if known. */
  readonly line?: number;
}

/** Discriminated union: success carries a kind + body, failure carries an error. */
export type ExtractResult =
  | { ok: true; kind: ExtractKind; body: string }
  | { ok: false; error: ParseError };

/**
 * Find the next fence line at or after `fromIndex` in `text`.
 * A fence line starts with optional whitespace, then ```, then optional
 * language tag (first word), then anything until end of line. Returns
 * `{ index, tag, afterIndex }` where `afterIndex` is the start of the
 * line *after* the fence (i.e. ready to read body content).
 */
function findFence(text: string, fromIndex: number): {
  index: number;
  tag: string | undefined;
  afterIndex: number;
} | null {
  const re = /(^|\n)[ \t]*```[ \t]*([a-zA-Z0-9_+-]*)/g;
  re.lastIndex = fromIndex;
  const m = re.exec(text);
  if (!m) return null;
  // The matched index points at the start of the line; the `^|\n` capture
  // is one char before the line content.
  const lineStart = m.index + (m[1] ? m[1].length : 0);
  const tag = m[2] || undefined;
  // Walk to end of line for `afterIndex`.
  let i = re.lastIndex;
  while (i < text.length && text.charCodeAt(i) !== 10 /* \n */) i++;
  if (i < text.length) i++; // consume the \n
  return { index: lineStart, tag, afterIndex: i };
}

/** Heuristic for unfenced content: is this code-shaped? */
function shapeKind(body: string): ExtractKind {
  const trimmed = body.trimStart();
  if (trimmed.startsWith('<')) {
    // Tag-shaped — tsx/html. Default to tsx (we don't actually render in v0.1.0).
    return 'tsx';
  }
  if (/^(function|const|let|var|class|export|import)\b/.test(trimmed)) {
    return 'tsx';
  }
  return 'plain';
}

/** Maps a fence language tag to an {@link ExtractKind}. */
function kindFromTag(tag: string | undefined): ExtractKind {
  if (!tag) return 'tsx'; // No tag on a fenced block is almost certainly code.
  const lower = tag.toLowerCase();
  if (lower === 'html') return 'html';
  return 'tsx'; // tsx, jsx, ts, js, anything else → treat as tsx-shaped.
}

/**
 * Find the line number (1-indexed) of `index` in `text`.
 */
function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}

/**
 * Extract a code artifact from a raw LLM response.
 *
 * Algorithm:
 * 1. Find the first ``` fence line. If found, find the next fence line
 *    after it. The body is everything between.
 * 2. If no fence, inspect the body shape.
 *
 * @param raw - The raw text returned by the provider.
 * @returns Either a kinded body, or a {@link ParseError}.
 */
export function extractArtifact(raw: string): ExtractResult {
  const text = raw.replace(/^\uFEFF/, ''); // strip BOM if present

  const open = findFence(text, 0);
  if (open) {
    const openLine = lineOf(text, open.index);
    const close = findFence(text, open.afterIndex);
    if (!close) {
      return {
        ok: false,
        error: { message: 'Unbalanced code fence', line: openLine },
      };
    }
    const body = text.slice(open.afterIndex, close.index).replace(/^\n+|\n+$/g, '');
    return { ok: true, kind: kindFromTag(open.tag), body };
  }

  // No fence — shape-detect.
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: true, kind: 'plain', body: '' };
  }
  return { ok: true, kind: shapeKind(trimmed), body: trimmed };
}
