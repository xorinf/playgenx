/**
 * TSX/HTML body parser for PlayGenX artifacts.
 *
 * Pure TypeScript, no React or JSX runtime required. Parses a body
 * string into a normalised {@link RendererNode} tree. Designed to
 * cover the surface that PlayGenX artifacts actually emit:
 *
 *   - PascalCase tag (matches a registry entry)
 *   - Lowercase built-in HTML tag
 *   - Self-closing tags (`<Foo />`)
 *   - Open/close pairs with nested children
 *   - String-literal attribute values: `<Foo label="Go" />`
 *   - Expression attribute values: `<Foo value={x} />`
 *   - Boolean shorthand: `<Foo disabled />`
 *   - Comments and string contents preserved inside the tree
 *     (so `<Heading>{title} greet</Heading>` parses cleanly)
 *
 * Out of scope: arbitrary JSX expressions on child positions
 * (`<Foo>{cond ? a : b}</Foo>` parses as two text children around
 * the `{...}` region with the braces stripped), template literals
 * with interpolations as attribute values, JSX fragments, JSX
 * member expressions (`<Foo.Bar />`), and full JSX expression
 * evaluation. Bodies that hit these regions fall back to a
 * {@link RendererFallthrough} carrying the source verbatim.
 *
 * @packageDocumentation
 */

import { stripJsComments } from '@playgenx/utils';
import type { ParsedProp, RendererNode } from './types.js';

/** Built-in HTML tag list. Mirrors `BUILT_IN_TAGS` from @playgenx/registry. */
const BUILT_IN_TAGS = new Set([
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'code',
  'pre',
  'button',
  'input',
  'label',
  'br',
  'hr',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'nav',
]);

/**
 * Parse a TSX/HTML body string into a normalised RendererNode tree.
 *
 * Returns one root node. If the body has multiple top-level siblings
 * the result is a synthetic `<Fragment>`-equivalent element whose
 * name is the literal string `''` and whose children are the
 * siblings. Callers that don't want this wrapper can call
 * {@link parseBodyNodes} to get the underlying list.
 */
export function parseBody(body: string): RendererNode {
  return {
    kind: 'element',
    name: '',
    props: [],
    children: parseNodes(body, 0).nodes,
  };
}

/**
 * Parse and return all top-level nodes without the synthetic wrapper.
 * Useful when the host already has its own root element.
 */
export function parseBodyNodes(body: string): RendererNode[] {
  const cleaned = stripJsComments(body);
  const result = parseNodes(cleaned, 0);
  return result.nodes;
}

// ---------------------------------------------------------------------------
// Internal helpers — operate on already-comment-stripped input.
// ---------------------------------------------------------------------------

interface Cursor {
  index: number;
}

interface ParseResult {
  readonly nodes: RendererNode[];
  readonly end: number;
}

function parseNodes(input: string, from: number): ParseResult {
  const out: RendererNode[] = [];
  let i = from;
  const n = input.length;
  // Walk until we hit a `<` that's the start of a tag, or end of input.
  // Plain text between tags becomes a single text node (trimmed of
  // leading whitespace only; collapse runs of whitespace to a single
  // space, but preserve newlines as separate).
  while (i < n) {
    const lt = input.indexOf('<', i);
    if (lt < 0 || lt >= n) {
      // Trailing text becomes one text node.
      const tail = input.slice(i);
      if (tail.trim().length > 0) {
        out.push({ kind: 'text', value: tail });
      }
      return { nodes: out, end: n };
    }
    if (lt > i) {
      const text = input.slice(i, lt);
      if (text.trim().length > 0) {
        out.push({ kind: 'text', value: text });
      }
      i = lt;
    }
    // Dispatch on the character after `<`.
    if (input.charCodeAt(i + 1) === 47 /* / */) {
      // Closing tag — return up the stack. Caller is responsible for
      // matching the open tag.
      return { nodes: out, end: i };
    }
    if (input.charCodeAt(i + 1) === 33 /* ! */) {
      // `<!-- comment -->` or `<!doctype>` — skip until `>`.
      const close = input.indexOf('>', i);
      if (close < 0) {
        // Unterminated comment/doctype — treat as fallthrough.
        out.push({ kind: 'fallthrough', value: input.slice(i) });
        return { nodes: out, end: n };
      }
      i = close + 1;
      continue;
    }
    if (input.charCodeAt(i + 1) === 62 /* > */) {
      // Stray `<>` — keep as one char each.
      out.push({ kind: 'text', value: '<>' });
      i += 2;
      continue;
    }

    // Either an opening tag we recognise, or a stray `<...>` we don't.
    const tag = parseOpenTag(input, i);
    if (tag === null) {
      // Skip the `<` character and continue scanning.
      out.push({ kind: 'text', value: '<' });
      i++;
      continue;
    }

    if (tag.selfClosing) {
      out.push(buildElement(tag.name, tag.props, []));
      i = tag.afterOpen;
      continue;
    }

    // Open/close pair. Recurse into children.
    const inner = parseNodes(input, tag.afterOpen);
    out.push(buildElement(tag.name, tag.props, inner.nodes));
    // If the inner parse stopped at a matching close tag, jump past it.
    // Otherwise consume whatever's left and surface the tag as
    // fallthrough so we don't lose the source.
    const closeTag = `</${tag.name}>`;
    if (input.startsWith(closeTag, inner.end)) {
      i = inner.end + closeTag.length;
    } else {
      // The closing tag is missing or mismatched. Push the remainder
      // as a single fallthrough and stop parsing.
      out.push({ kind: 'fallthrough', value: input.slice(i) });
      return { nodes: out, end: n };
    }
  }
  return { nodes: out, end: n };
}

interface OpenTag {
  readonly name: string;
  readonly props: ParsedProp[];
  readonly selfClosing: boolean;
  readonly afterOpen: number;
}

/**
 * Read `<Name ... >` or `<Name ... />`. Returns `null` if input does
 * not look like an opening tag (e.g. starts with a digit, or has
 * syntactically illegal content). The cursor contract: never read
 * beyond the closing `>` or `/>`.
 */
function parseOpenTag(input: string, from: number): OpenTag | null {
  const cursor: Cursor = { index: from + 1 };
  const name = readTagName(input, cursor);
  if (name === null || name.length === 0) return null;
  const props = readProps(input, cursor);
  const c = input.charCodeAt(cursor.index);
  let selfClosing = false;
  if (c === 47 /* / */) {
    selfClosing = true;
    cursor.index++;
    if (input.charCodeAt(cursor.index) !== 62 /* > */) return null;
    cursor.index++;
  } else if (c === 62 /* > */) {
    cursor.index++;
  } else {
    return null;
  }
  return { name, props, selfClosing, afterOpen: cursor.index };
}

function readTagName(input: string, cursor: Cursor): string | null {
  const start = cursor.index;
  const n = input.length;
  // Tag names start with an ASCII letter (no components in
  // DEFAULT_REGISTRY that don't). Allow ASCII letters and digits.
  if (start >= n) return null;
  const c0 = input.charCodeAt(start);
  if (!((c0 >= 65 && c0 <= 90) || (c0 >= 97 && c0 <= 122))) {
    return null;
  }
  let i = start + 1;
  while (i < n) {
    const cc = input.charCodeAt(i);
    if (
      (cc >= 65 && cc <= 90) ||
      (cc >= 97 && cc <= 122) ||
      (cc >= 48 && cc <= 57) ||
      cc === 45 /* - */
    ) {
      i++;
      continue;
    }
    break;
  }
  cursor.index = i;
  return input.slice(start, i);
}

/**
 * Read zero or more attribute pairs. Stops at the first `>` or `/>`.
 * Keeps each parsed prop in source order; errored props (e.g. a
 * numeric-looking attribute name) are skipped, not coerced.
 */
function readProps(input: string, cursor: Cursor): ParsedProp[] {
  const out: ParsedProp[] = [];
  const n = input.length;
  while (cursor.index < n) {
    // Skip whitespace.
    while (cursor.index < n && /\s/.test(input[cursor.index] ?? '')) cursor.index++;
    if (cursor.index >= n) break;
    const c = input.charCodeAt(cursor.index);
    if (c === 47 /* / */ || c === 62 /* > */) break;
    // Read prop name.
    const nameStart = cursor.index;
    if (!/[A-Za-z_$]/.test(input[cursor.index] ?? '')) {
      // Unexpected character — skip one position so we don't loop.
      cursor.index++;
      continue;
    }
    let i = nameStart + 1;
    while (i < n && /[A-Za-z0-9_$-]/.test(input[i] ?? '')) i++;
    const propName = input.slice(nameStart, i);
    cursor.index = i;
    if (propName === '') continue;
    // Skip whitespace before '='.
    while (cursor.index < n && /\s/.test(input[cursor.index] ?? '')) cursor.index++;
    if (cursor.index >= n) break;
    if (input.charCodeAt(cursor.index) === 62 || input.charCodeAt(cursor.index) === 47) {
      // Boolean shorthand.
      out.push({ name: propName, kind: 'boolean', value: 'true' });
      continue;
    }
    if (input.charCodeAt(cursor.index) !== 61 /* = */) {
      // Garbage before next prop — advance and continue.
      cursor.index++;
      continue;
    }
    cursor.index++; // consume '='
    while (cursor.index < n && /\s/.test(input[cursor.index] ?? '')) cursor.index++;
    const value = readPropValue(input, cursor, propName);
    if (value === null) {
      // Unterminated value; skip the prop so we don't hang.
      cursor.index++;
      continue;
    }
    out.push(value);
  }
  return out;
}

function readPropValue(input: string, cursor: Cursor, propName: string): ParsedProp | null {
  const n = input.length;
  if (cursor.index >= n) return null;
  const c = input.charCodeAt(cursor.index);
  if (c === 34 /* " */ || c === 39 /* ' */) {
    const quote = c;
    const valStart = cursor.index;
    cursor.index++;
    while (cursor.index < n && input.charCodeAt(cursor.index) !== quote) {
      cursor.index++;
    }
    // Include the closing quote in the value so string literals
    // round-trip as their raw source form.
    if (cursor.index < n) cursor.index++;
    return { name: propName, kind: 'string', value: input.slice(valStart, cursor.index) };
  }
  if (c === 123 /* { */) {
    cursor.index++;
    let depth = 1;
    const innerStart = cursor.index;
    while (cursor.index < n && depth > 0) {
      const cc = input.charCodeAt(cursor.index);
      if (cc === 123) depth++;
      else if (cc === 125) {
        depth--;
        if (depth === 0) break;
      } else if (cc === 34 || cc === 39 || cc === 96) {
        const q = cc;
        cursor.index++;
        while (cursor.index < n && input.charCodeAt(cursor.index) !== q) {
          if (input.charCodeAt(cursor.index) === 92 && cursor.index + 1 < n) cursor.index++;
          cursor.index++;
        }
        continue;
      }
      cursor.index++;
    }
    const raw = input.slice(innerStart, cursor.index).trim();
    if (cursor.index < n) cursor.index++; // closing brace
    return { name: propName, kind: classifyExpression(raw), value: raw };
  }
  // Bare literal: read until whitespace or `/` or `>`.
  const startBare = cursor.index;
  while (cursor.index < n && !/[\s/>]/.test(input[cursor.index] ?? '')) cursor.index++;
  const bare = input.slice(startBare, cursor.index);
  if (bare === '') return null;
  return { name: propName, kind: classifyExpression(bare), value: bare };
}

function classifyExpression(s: string): ParsedProp['kind'] {
  const t = s.trim();
  if (t === 'true' || t === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(t)) return 'number';
  return 'expression';
}

function buildElement(name: string, props: ParsedProp[], children: RendererNode[]): RendererNode {
  return { kind: 'element', name, props, children };
}

/**
 * Exposed for the renderer.tsx path to know whether a name belongs to
 * the built-in HTML tag whitelist (and so can be passed straight
 * through as a React intrinsic element). Useful when checking if a
 * fallthrough is due to a missing component vs a typo'd tag.
 *
 * Note: HTML tag names are case-insensitive per the HTML spec, but
 * we DO NOT lowercase before lookup — PascalCase names go through
 * the registry path, even if their lowercase form would match a
 * built-in tag. This avoids accidentally promoting a component
 * called `Button` into a `<button>` element when the registry
 * doesn't have it.
 */
export function isBuiltInTag(name: string): boolean {
  return BUILT_IN_TAGS.has(name);
}
