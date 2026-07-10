/**
 * Extracts a single code artifact from a raw LLM response.
 *
 * The extraction is deliberately conservative in v0.2.x: it understands
 * fenced code blocks (```tsx, ```html, ```jsx, ```json, untagged) and
 * falls back to shape-based detection for unfenced content. Real
 * syntax-aware parsing lands later.
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
 * Maps a fence language tag to an {@link ExtractKind}.
 *
 * Known code-shaped tags map to `'tsx'` (we don't actually parse the
 * body — the validator's job is to enforce shape). The tag `'json'`
 * also maps to `'tsx'` because the parser doesn't distinguish JSON-shaped
 * from JSX-shaped content; the kind-specific handling is in the core
 * pipeline (skipJsxCheck is set automatically for JSON-bodied kinds).
 */
function kindFromTag(tag: string): ExtractKind {
  if (tag === 'html') return 'html';
  return 'tsx'; // tsx, jsx, json, untagged, anything else — treat as code.
}

/** Heuristic for unfenced content: is this code-shaped? */
function shapeKind(body: string): ExtractKind {
  const trimmed = body.trimStart();
  if (trimmed.startsWith('<')) {
    return 'tsx';
  }
  if (/^(function|const|let|var|class|export|import)\b/.test(trimmed)) {
    return 'tsx';
  }
  return 'plain';
}

/**
 * Find the 1-indexed line number of `index` in `text`.
 * Returns 1 if index is 0 or negative.
 */
function lineOf(text: string, index: number): number {
  if (index <= 0) return 1;
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}

/**
 * Try to read a language tag right after a fence opener. The tag is the
 * longest run of `[A-Za-z0-9_+-]` characters immediately after the
 * backticks. Returns `undefined` if no tag is present.
 *
 * Stops at the first non-tag character (whitespace, newline, etc).
 */
function readTag(text: string, afterBackticks: number): {
  tag: string | undefined;
  nextIndex: number;
} {
  let i = afterBackticks;
  let tag = '';
  while (i < text.length) {
    const ch = text.charCodeAt(i);
    if (
      (ch >= 65 && ch <= 90) || // A-Z
      (ch >= 97 && ch <= 122) || // a-z
      (ch >= 48 && ch <= 57) || // 0-9
      ch === 43 || // +
      ch === 45 || // -
      ch === 95    // _
    ) {
      tag += text[i];
      i++;
    } else {
      break;
    }
  }
  return { tag: tag || undefined, nextIndex: i };
}

/**
 * Find the next fence line at or after `fromIndex` in `text`.
 *
 * A fence line is one that:
 *   - starts the line (preceded by `\n` or start-of-input)
 *   - has only whitespace between line start and the fence marker
 *   - the marker is either ``` (backtick) or ~~~ (tilde) — at least
 *     3 of either character, all the same
 *   - has an optional language tag (for ```) immediately after the marker
 *   - ends at end-of-line (anything after the tag is allowed but ignored)
 *
 * If we encounter a mid-line backtick/tilde run (e.g. `here's the code:
 * \`\`\`tsx`), we return `null` so the caller can fall through to shape
 * detection of the whole input. This is safer than skipping — skipping
 * the leading ``` and treating the trailing one as the opener would
 * produce a "no closing fence" error on otherwise-fine input.
 */
function findFence(
  text: string,
  fromIndex: number,
): { index: number; tag: string | undefined; afterIndex: number; marker: string } | null {
  let i = fromIndex;
  while (i < text.length) {
    const ch = text.charCodeAt(i);

    // Determine fence marker: 3+ backticks or 3+ tildes at this position.
    let marker: string | null = null;
    if (ch === 96 /* ` */ && i + 2 < text.length && text[i + 1] === '`' && text[i + 2] === '`') {
      marker = '```';
    } else if (ch === 126 /* ~ */ && i + 2 < text.length && text[i + 1] === '~' && text[i + 2] === '~') {
      marker = '~~~';
    }

    if (marker) {
      // Check that this fence is at the start of a line (with optional
      // whitespace prefix).
      let lineStart = i;
      while (lineStart > 0 && text.charCodeAt(lineStart - 1) !== 10 /* \n */) {
        lineStart--;
      }
      let prefixOk = true;
      for (let j = lineStart; j < i; j++) {
        const c = text.charCodeAt(j);
        if (c !== 32 /* space */ && c !== 9 /* tab */) {
          prefixOk = false;
          break;
        }
      }
      if (prefixOk) {
        // For backticks, try to read a language tag. For tildes, no tag.
        let tag: string | undefined;
        let nextIndex = i + marker.length;
        if (marker === '```') {
          const r = readTag(text, nextIndex);
          tag = r.tag;
          nextIndex = r.nextIndex;
        }
        // Walk to end of line for `afterIndex`.
        let end = nextIndex;
        while (end < text.length && text.charCodeAt(end) !== 10 /* \n */) end++;
        if (end < text.length) end++; // consume the newline
        return { index: i, tag, afterIndex: end, marker };
      }
      // Mid-line fence markers — bail to shape detection.
      return null;
    }
    i++;
  }
  return null;
}

/**
 * Extract a code artifact from a raw LLM response.
 *
 * Algorithm:
 * 1. Strip a leading BOM if present.
 * 2. Find the first ``` fence line. If found, find the next fence line
 *    after it. The body is everything between.
 * 3. If no fence, inspect the body shape.
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
    // Body is from afterIndex to close.index, with leading/trailing
    // newlines and carriage returns trimmed (but not interior whitespace).
    const body = text
      .slice(open.afterIndex, close.index)
      .replace(/^[\r\n]+|[\r\n]+$/g, '');
    return { ok: true, kind: kindFromTag(open.tag ?? ''), body };
  }

  // No fence — shape-detect.
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: true, kind: 'plain', body: '' };
  }
  return { ok: true, kind: shapeKind(trimmed), body: trimmed };
}