import { stripJsComments } from './strip-comments.js';

/**
 * Extract the props attached to a single `<Name ... />` opening tag in
 * a body of TSX/HTML. Returns one entry per prop, with a coarse `kind`
 * discriminator ('string', 'number', 'boolean', 'expression') so the
 * validator can decide whether the value matches the schema.
 *
 * Scope: this is for *validation* only. It does NOT try to evaluate
 * the expressions (e.g. `{Math.PI}` is reported as kind 'expression'
 * with raw text 'Math.PI'); the validator decides what's allowed. A
 * full renderer needs a parser — out of scope here.
 *
 * @example
 * // <Button label="Go" disabled={true} variant={variant} />
 * propsOfTag(cleaned, 'Button')
 * // → [
 * //   { name: 'label', kind: 'string', value: '"Go"' },
 * //   { name: 'disabled', kind: 'boolean', value: 'true' },
 * //   { name: 'variant', kind: 'expression', value: 'variant' },
 * // ]
 */

export interface JsxProp {
  readonly name: string;
  /** Coarse kind of the literal value the source uses. */
  readonly kind: 'string' | 'number' | 'boolean' | 'expression';
  /** Raw text of the value, including quotes for strings. */
  readonly value: string;
}

export function propsOfTag(body: string, name: string): JsxProp[] {
  const cleaned = stripJsComments(body);
  // Find an opening tag whose name matches `name`. We use a regex
  // anchored to `<Name` so we don't pick up names that appear inside
  // attribute names (which are camelCase, not PascalCase, but cheap to
  // be explicit).
  const re = new RegExp(`<${name}([\\s/>])`, 'g');
  const out: JsxProp[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    // Walk forward from the position after `<Name` until we hit either
    // `>` (self-closing tag) or `/>` (true self-closing). Capture the
    // prop list in between.
    const start = m.index + 1 + name.length;
    const end = findTagEnd(cleaned, start);
    if (end < 0) continue;
    const props = parsePropList(cleaned.slice(start, end));
    out.push(...props);
  }
  return out;
}

function findTagEnd(s: string, from: number): number {
  for (let i = from; i < s.length; i++) {
    if (s.charCodeAt(i) === 62 /* > */) return i;
    if (s.charCodeAt(i) === 47 /* / */ && s.charCodeAt(i + 1) === 62 /* > */) return i + 1;
  }
  return -1;
}

function parsePropList(s: string): JsxProp[] {
  const out: JsxProp[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    // Always advance at least one character per iteration, even when
    // we hit something we can't parse — otherwise we'd loop forever
    // on bodies that have stray delimiters between attributes.
    const startOfStep = i;

    // Skip whitespace.
    while (i < n && /\s/.test(s[i] ?? '')) i++;
    if (i >= n) break;

    // If we landed on '/' or '>' or any other non-identifier char,
    // consume one character and continue. This keeps us making
    // progress without inferring a malformed-but-positional prop.
    const c = s.charCodeAt(i);
    if (c === 47 /* / */ || c === 62 /* > */ || !/[A-Za-z]/.test(s[i] ?? '')) {
      i++;
      continue;
    }

    // Read prop name (lowercase or camelCase).
    const nameStart = i;
    while (i < n && /[A-Za-z0-9_-]/.test(s[i] ?? '')) i++;
    const propName = s.slice(nameStart, i);
    if (!propName || propName.startsWith('-')) continue;

    // Skip whitespace before '=' or '/'.
    while (i < n && /\s/.test(s[i] ?? '')) i++;

    // Boolean shorthand: `<Button disabled />` — no '=' follows.
    if (i >= n || s.charCodeAt(i) === 47 /* / */ || s.charCodeAt(i) === 62 /* > */) {
      out.push({ name: propName, kind: 'boolean', value: 'true' });
      continue;
    }
    if (s.charCodeAt(i) !== 61 /* = */) {
      // Malformed: next char is unexpected (e.g. just whitespace +
      // end of input). Consume one and continue so we don't loop.
      i++;
      continue;
    }
    i++; // consume '='
    while (i < n && /\s/.test(s[i] ?? '')) i++;

    // Three value forms: "..."  '...'  {...}
    if (s.charCodeAt(i) === 34 /* " */ || s.charCodeAt(i) === 39 /* ' */) {
      const quote = s.charCodeAt(i);
      const valStart = i;
      i++; // consume open quote
      while (i < n && s.charCodeAt(i) !== quote) i++;
      if (i < n) i++; // consume close quote
      out.push({ name: propName, kind: 'string', value: s.slice(valStart, i) });
      if (i === startOfStep) i++; // paranoia: guarantee forward progress
      continue;
    }
    if (s.charCodeAt(i) === 123 /* { */) {
      // Read until matching `}`.
      let depth = 1;
      const valStart = i;
      i++; // consume '{'
      while (i < n && depth > 0) {
        const cc = s.charCodeAt(i);
        if (cc === 123) depth++;
        else if (cc === 125) {
          depth--;
          if (depth === 0) break; // do NOT i++ past the closing brace
        } else if (cc === 34 || cc === 39 || cc === 96) {
          const q = cc;
          i++;
          while (i < n && s.charCodeAt(i) !== q) {
            if (s.charCodeAt(i) === 92 /* \ */ && i + 1 < n) i++;
            i++;
          }
          continue;
        }
        i++;
      }
      if (i < n) i++; // consume '}'
      const inner = s.slice(valStart + 1, i - 1).trim();
      out.push({ name: propName, kind: classifyExpression(inner), value: inner });
      if (i === startOfStep) i++; // paranoia: guarantee forward progress
      continue;
    }
    if (i >= n) break;

    // Bare value (rare; e.g. `<Foo bar=true />`). Read until whitespace.
    const valStart = i;
    while (i < n && !/[\s/>]/.test(s[i] ?? '')) i++;
    const bare = s.slice(valStart, i);
    if (bare) {
      out.push({ name: propName, kind: classifyExpression(bare), value: bare });
    }
    if (i === startOfStep) i++; // paranoia: guarantee forward progress
  }
  return out;
}

function classifyExpression(s: string): JsxProp['kind'] {
  const t = s.trim();
  if (t === 'true' || t === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(t)) return 'number';
  return 'expression';
}
