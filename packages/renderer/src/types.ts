/**
 * Renderer tree types.
 *
 * Parsing produces a normalised tree that the renderer can reify
 * against a caller-supplied component map. The tree has only three
 * shapes:
 *
 *  - {@link RendererElement}: a PascalCase tag matched against the
 *    registry. Carries a name, parsed props, and children.
 *  - {@link RendererText}: a string leaf.
 *  - {@link RendererFallthrough}: a malformed / unparseable region
 *    preserved verbatim so callers can render it as <pre> for
 *    debugging.
 *
 * Built-in HTML tags (lowercase) are kept as elements too — the
 * renderer maps them to plain React elements at the leaves of the
 * tree (e.g. `div`, `p`, `button`).
 *
 * @packageDocumentation
 */

import type * as React from 'react';

/**
 * Coarse kind of a parsed prop value. Mirrors the `jsx-props` module
 * in @playgenx/utils so the renderer doesn't need to redo the work.
 */
export type PropKind = 'string' | 'number' | 'boolean' | 'expression';

/** A single parsed prop on a component. */
export interface ParsedProp {
  readonly name: string;
  readonly kind: PropKind;
  /**
   * Raw text of the value. For strings, includes the quotes (e.g.
   * `'"hello"'`). For expressions, the inner code (e.g. `'myValue'`).
   * For booleans, `'true'` or `'false'`.
   */
  readonly value: string;
}

/** A rendered text leaf. JSX children that are pure strings collapse here. */
export interface RendererText {
  readonly kind: 'text';
  readonly value: string;
}

/** A rendered element, either a registered component or a built-in tag. */
export interface RendererElement {
  readonly kind: 'element';
  /** Tag name as it appears in source. */
  readonly name: string;
  /** Parsed props in source order. */
  readonly props: readonly ParsedProp[];
  /** Children. */
  readonly children: readonly RendererNode[];
}

/** A region of the source that we couldn't parse. Rendered as <pre>. */
export interface RendererFallthrough {
  readonly kind: 'fallthrough';
  readonly value: string;
}

/** Anything the parser can produce. */
export type RendererNode = RendererElement | RendererText | RendererFallthrough;

/**
 * Map of component name → React component. The renderer asks for
 * this once per render. Resolution rules:
 *
 *   1. PascalCase name (`Button`, `Card`) MUST be in the map; if not,
 *      the element falls back to `RendererFallthrough` with the
 *      source verbatim.
 *   2. Lowercase built-in names (`div`, `p`, `span`, `h1..h6`, ...)
 *      are passed straight through as React intrinsic elements.
 *   3. Anything else also falls back.
 *
 * The default map comes from `@playgenx/components.componentMap`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentMap = Record<string, React.ComponentType<any>>;

/**
 * Render-input props for an element. The renderer filters out
 * props the underlying component cannot accept (boolean shorthand,
 * event handlers, raw expression refs that React warns about).
 *
 * We can't statically know which props are valid for a component,
 * so we follow a permissive policy: well-known safe primitives
 * (numbers, strings, booleans) are forwarded directly; expressions
 * become a placeholder object whose `Symbol.toPrimitive` returns
 * the source text. This is enough for the deterministic rendering
 * described in the playground prompt — callouts that need data
 * pass it via `data-props` JSON in the source.
 */
export interface RenderInputProps {
  readonly [name: string]: unknown;
  /** Marker so listeners can introspect the source. */
  readonly 'data-renderer-name'?: string;
}

/**
 * Options bag for {@link renderBody}. The flags are doc-only stubs
 * for v0.5 — see `renderBody` in `render.tsx` for the runtime
 * behavior. Re-exported as a type so consumers can pass it
 * structurally without importing from the implementation module.
 */
export interface RenderBodyOptions {
  /** Surface render failures to `console.error`. Default `false`. */
  readonly throwOnError?: boolean;
  /**
   * Reserved for a future release. When `true`, the renderer
   * would mount a sandboxed iframe for untrusted bodies. In v0.5
   * the flag is accepted and ignored (with a dev-mode
   * `console.warn`).
   */
  readonly iframeFallback?: boolean;
}
