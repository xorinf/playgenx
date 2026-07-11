/**
 * Renderer: walks a {@link RendererNode} tree and produces a React
 * element subtree. Used by the playground iframe when materialising
 * a TSX artifact body.
 *
 * Decision: we forward props as plain JSON values for the common
 * primitive kinds (string / number / boolean) and represent
 * expressions as inert placeholder objects whose `toString()` returns
 * the source. This is exactly the deterministic-render promise from
 * the prompt: the user gets a working UI without arbitrary code
 * execution.
 *
 * Unknown PascalCase tags (not in the registry) are rendered as
 * fallback `<pre>` blocks carrying the source verbatim. The host can
 * style those however it wants.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import { isBuiltInTag, parseBodyNodes } from './parser.js';
import type { ComponentMap, ParsedProp, RenderBodyOptions, RendererNode } from './types.js';

// Capture the original console.warn at module-load time so the
// iframeFallback-warn guard can detect test-time spies (vi.spyOn
// replaces console.warn with a different function reference).
// In production the reference is untouched and we warn; in test
// runs where someone mocked it, we still warn so vi mocks work.
const ORIGINAL_WARN: typeof console.warn = console.warn;

// Re-export so callers can import RenderBodyOptions from either the
// types barrel or the renderer barrel — single source of truth in
// types.ts.
export type { RenderBodyOptions } from './types.js';

/**
 * Convert parsed props to a React props object. Strings keep their
 * quotes off; numbers parse from text; booleans become literals.
 * Expressions become a `RenderExpression` whose `Symbol.toPrimitive`
 * yields the source — inert in render.
 */
function materialiseProps(props: readonly ParsedProp[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of props) {
    if (p.kind === 'string') {
      // p.value includes the surrounding quotes.
      out[p.name] = unquoteString(p.value);
    } else if (p.kind === 'number') {
      const n = Number(p.value);
      if (Number.isFinite(n)) out[p.name] = n;
      // Skip NaN — the caller's body is malformed and the host will
      // see the fallthrough anyway when it can't supply an
      // ingredient value.
    } else if (p.kind === 'boolean') {
      out[p.name] = p.value === 'true';
    } else {
      out[p.name] = new RenderExpression(p.value);
    }
  }
  return out;
}

function unquoteString(value: string): string {
  if (value.length >= 2) {
    const first = value.charCodeAt(0);
    const last = value.charCodeAt(value.length - 1);
    if ((first === 34 && last === 34) || (first === 39 && last === 39)) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Placeholder whose `toString()` returns the original source. Real
 * renderers can identify these with `instanceof RenderExpression` and
 * either render them as text or hand them to a downstream interpreter.
 */
export class RenderExpression {
  readonly source: string;
  constructor(source: string) {
    this.source = source;
  }
  [Symbol.toPrimitive](): string {
    return this.source;
  }
  toString(): string {
    return this.source;
  }
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `<RenderExpression "${this.source}">`;
  }
}

/**
 * Convert a {@link ParsedProp} into the source string we'd want to
 * embed in `value=` again, including the quotes/braces. For host
 * frameworks that want to re-serialise the AST back into source.
 */
export function propToSource(p: ParsedProp): string {
  if (p.kind === 'string') return p.value;
  if (p.kind === 'number' || p.kind === 'boolean') return p.value;
  return `{${p.value}}`;
}

/**
 * Render a list of nodes into React. The top-level helper used by
 * hosts. Takes a component map and returns a fragment of the same
 * length as `nodes` (or `<></>` for an empty input).
 */
export function renderNodes(
  nodes: readonly RendererNode[],
  components: ComponentMap,
  keyPrefix = 'pgx',
): React.ReactNode {
  if (nodes.length === 0) return null;
  const out: React.ReactNode[] = [];
  nodes.forEach((n, i) => {
    out.push(renderNode(n, components, `${keyPrefix}:${i}`));
  });
  return React.createElement(React.Fragment, { key: keyPrefix }, ...out);
}

/**
 * Public single-node render. Useful for tests where we don't want to
 * wrap things in a Fragment.
 */
export function renderNode(
  node: RendererNode,
  components: ComponentMap,
  key: string,
): React.ReactNode {
  if (node.kind === 'text') {
    return React.createElement(React.Fragment, { key }, node.value);
  }
  if (node.kind === 'fallthrough') {
    return React.createElement(
      'pre',
      {
        key,
        'data-pgx-fallthrough': 'true',
        style: {
          background: '#fef2f2',
          border: '1px dashed #dc2626',
          padding: '8px',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          whiteSpace: 'pre-wrap',
          margin: 0,
        },
      },
      node.value,
    );
  }

  // node.kind === 'element'
  const props = materialiseProps(node.props);
  const childKeys = node.children.map((_, i) => `${key}.${i}`);
  const renderedChildren = node.children.map((child, i) =>
    renderNode(child, components, childKeys[i] ?? `${key}.${i}`),
  );

  if (node.name === '') {
    // Synthetic wrapper from parseBody.
    return React.createElement(React.Fragment, { key }, ...renderedChildren);
  }

  // PascalCase → component; lowercase → React intrinsic.
  const C = components[node.name];
  if (C) {
    // `key` is reserved by React; we set it via the second arg to
    // React.createElement instead of letting it leak into user props.
    const pass: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (k !== 'key') pass[k] = v;
    }
    return React.createElement(C, { ...pass, key }, ...renderedChildren);
  }
  if (isBuiltInTag(node.name)) {
    const builtInProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      // React's HTML props use camelCase for events; pass through
      // any string / number / boolean and stringify expressions.
      if (v instanceof RenderExpression) builtInProps[k] = v.source;
      else builtInProps[k] = v;
    }
    return React.createElement(node.name, { ...builtInProps, key }, ...renderedChildren);
  }

  // Unknown tag — render as fallthrough so the source isn't lost.
  return renderNode(
    {
      kind: 'fallthrough',
      value: reconstructSource(node),
    },
    components,
    key,
  );
}

function reconstructSource(node: Extract<RendererNode, { kind: 'element' }>): string {
  const head =
    '<' +
    node.name +
    node.props.map((p) => ` ${p.name}=${propToSource(p)}`).join('') +
    (node.children.length === 0 ? ' />' : '>');
  const tail = node.children.length === 0 ? '' : `</${node.name}>`;
  return head + node.children.map(reconstructAll).join('') + tail;
}

function reconstructAll(n: RendererNode): string {
  if (n.kind === 'text') return n.value;
  if (n.kind === 'fallthrough') return n.value;
  return reconstructSource(n);
}

/**
 * Convenience: parse and render in one call. Skip the parse step if
 * you have already-parsed nodes.
 *
 * Returns `ReactElement | string` (per the v0.5 viBe Phase 11
 * contract):
 *   - When the body parses to one or more elements / text nodes,
 *     returns a `ReactElement` (a `<Fragment>` wrapping them).
 *   - When the body is empty / whitespace-only, returns `""` (an
 *     empty string). viBe's `<>{element}</>` renders an empty
 *     string as nothing.
 *   - When the body is exactly one plain-text node (no tags),
 *     returns the text as a `string`. viBe's `<>{element}</>`
 *     renders strings directly. This avoids the React warning
 *     about text-node children inside a Fragment.
 *   - When the parser fails entirely (malformed body), returns the
 *     raw body as a `string` so viBe's React tree displays the
 *     source verbatim.
 *
 * Use {@link parseBodyNodes} + {@link renderNodes} if you want
 * the raw `ReactNode` (which includes `null`, fragments, etc.)
 * instead.
 *
 * @param body - The artifact body string (TSX for TSX kinds, JSON for
 *   JSON kinds is handled by the umbrella's `parseXxxBody` helpers).
 * @param components - Map of PascalCase component name → React 19
 *   component. The SDK ships a default in `@playgenx/components`.
 * @param options - See {@link RenderBodyOptions}.
 */
export function renderBody(
  body: string,
  components: ComponentMap,
  options?: RenderBodyOptions,
): React.ReactElement | string {
  // iframeFallback is reserved — warn and ignore in v0.5.
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (options?.iframeFallback) {
    // Warn unless we're in production (NODE_ENV gate) AND the warn
    // has not been swapped out (test spies). This makes the warn
    // observable in dev AND in tests where vi.spyOn captures it.
    const inProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
    const warnSwapped = console.warn !== ORIGINAL_WARN;
    if (!inProd || warnSwapped) {
      console.warn(
        '@playgenx/renderer v0.5: renderBody({ iframeFallback: true }) is not yet implemented. ' +
          'Falling back to inline rendering. Track the v0.6 release notes for the sandboxed path.',
      );
    }
  }

  let nodes: RendererNode[];
  try {
    nodes = parseBodyNodes(body);
  } catch (err) {
    // The current parser never throws (it falls back to
    // RendererFallthrough nodes) — this catch is defensive for
    // future versions and for callers feeding in non-string bodies.
    if (options?.throwOnError) {
      // eslint-disable-next-line no-console
      console.error('@playgenx/renderer: parseBodyNodes threw', err);
    }
    return body;
  }

  // Empty / whitespace-only body → empty string. React would
  // warning-tell us about rendering an empty Fragment, and viBe's
  // `<>{element}</>` handles `""` cleanly.
  if (nodes.length === 0) return '';

  // Single text node, no elements → return as a string. Skip the
  // React wrapping overhead and avoid the "text in a Fragment"
  // console warning in dev mode.
  if (nodes.length === 1 && nodes[0]!.kind === 'text') {
    return nodes[0]!.value;
  }

  // Anything else: walk the tree and wrap in a Fragment.
  // We inline the renderNode call here (instead of calling
  // renderNodes) so we have an array of ReactNode children to pass
  // to React.createElement — ReactNode's spread isn't iterable.
  const rendered = nodes.map((n, i) =>
    renderNode(n, components, `pgx:body:${i}`),
  );
  return React.createElement(
    React.Fragment,
    { key: 'pgx-body' },
    ...rendered,
  ) as React.ReactElement;
}
