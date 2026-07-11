---
tags: [retro, pr4, renderer, playground]
pr: 4
commit: 8a034b5
---

# PR 4 — @playgenx/renderer + playground Sandbox

**What:** New package. Pure-TS parser (no Babel) that turns a
TSX/HTML body into a normalised `RendererNode` tree, plus a
React 19 renderer that walks the tree against a caller-supplied
`componentMap`. `apps/playground`'s `Sandbox` swapped from
`<iframe srcDoc=source-text>` to `renderBody(body, componentMap)`.

**Why no Babel:** Babel would add ~700KB gzipped to the runtime
iframe. A hand-rolled parser covers the artifact surface (no
member expressions, no fragments, no JSX expressions on child
positions in the prompts) for 4.96KB gzipped. The parser is in
`packages/renderer/src/parser.ts` (~12KB source).

**Tree shape:**

```ts
type RendererNode =
  | RendererElement // PascalCase tag with parsed props + children
  | RendererText // string leaf
  | RendererFallthrough; // malformed region, render as <pre>

interface ParsedProp {
  name: string;
  kind: 'string' | 'number' | 'boolean' | 'expression';
  value: string; // includes quotes for strings
}
```

**Expression values** (`{value={x}}`): forwarded to React as
`RenderExpression` placeholder objects whose `toString()`
returns the source. Inert at render — no `eval`, no `new Function`.

**Unknown PascalCase tag** (not in registry, not built-in): no
crash, no silent drop. Renderer falls back to a `<pre
data-pgx-fallthrough>` block carrying the source verbatim. Host
apps can style / suppress as they prefer.

**Decisions worth remembering:**

- Built-in HTML tags are passed straight through as React
  intrinsics (no schema check; HTML attribute model is React's,
  not ours).
- PascalCase is required. `isBuiltInTag('Section')` returns
  `false` so a component called `Section` doesn't get promoted
  to `<section>`.
- Inline-`<pre>` for multi-line Code; inline-`<code>` for one-line.
  Based on whether children string contains `\n`. Rough heuristic
  but matches the prompt surface.

**Bugs fixed during the PR:**

1. `propsOfTag` returned wrong `name` on string-literal values
   (a placeholder name I'd written during early scaffolding).
   Fix: pass `propName` explicitly into `readPropValue`.
2. `isBuiltInTag` lowercased, which made `Button` (component)
   match `<button>`. Removed the lowercase.
3. Slice indexing on the closing quote — value came out as
   `"Go` (missing trailing quote). Fixed by advancing cursor
   past the closing quote _before_ slicing.
4. `JSX.Element` namespace not found in `LibraryPanel.tsx` —
   switched return types to `ReactElement` with an explicit
   `import { type ReactElement }`.

**Tests:** 25 (parser + render). Registry-coverage test verifies
`componentMap` keys match `DEFAULT_REGISTRY.list()` exactly.

**Bundle:** renderer tarball 13.1KB / 5.0KB gzipped. Playground
bundle 211KB / 67KB gzipped.

**Trade-off:** Sandbox is no longer sandboxed (no iframe).
Production hardening is a separate concern — a CSP iframe
wrapper around `renderBody` is the next step when shipping to
untrusted users.

**Next:** PR 5 wires `@playgenx/storage-react` into the
playground so the rendered artifacts can be persisted.
