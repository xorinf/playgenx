---
tags: [retro, pr3b, components, react]
pr: 3b
commit: 2fedbcf
---

# PR 3b — @playgenx/components (11 React 19 impls)

**What:** New package, peer-deps on `react@^19.2.0` +
`react-dom@^19.2.0`. Real implementations for every entry in
`DEFAULT_REGISTRY`. Exposes a `componentMap` keyed by PascalCase
name so render-time code can do `<C {...props} />` after a
registry lookup.

**Components shipped:**

| Name | State | Notes |
|---|---|---|
| Button | stateless | label, variant, disabled, onClick |
| TextField | controlled-or-uncontrolled | label, value, placeholder, disabled, onChange |
| Slider | clamped range | min/max required, value, step, label |
| Chart | stateless | bar / line / pie via hand-rolled SVG |
| Container | stateless | padding + gap (CSS) |
| Code | stateless | inline or `<pre>` block |
| Heading | level-clamped | renders h1..h6, clamps out-of-range |
| Text | stateless | weight, size, color (CSS) |
| Stepper | multi-step | aria-current, disabled-when-future, click to advance |
| Card | stateless | title, elevation (shadow by level) |
| List | stateless | items array → `<ul>` or `<ol>` |

**Why hand-rolled Chart (no recharts/visx):**

- recharts would add ~80KB to the bundle.
- visx is more about composition; bar/line/pie in ~50 LOC of
  inline SVG is enough for the playground prompt surface.
- The Chart `kind: 'data'` prop accepts an `unknown`. At
  runtime: bar/line/pie parse `{labels, values}` or `{x, y}` or
  `{series}`. Anything else renders a `<pre>` with the source —
  visible, debuggable failure mode.

**Determinism:** None of the 11 components call `Math.random`,
`Date.now`, or runtime-crypto. Three "render determinism"
snapshot tests verify byte-equal output across rerenders.

**Tests:** 39 (3 per component on average). jsdom + RTL. Registry
coverage test verifies `componentMap` has entries for every name
in `DEFAULT_REGISTRY` and *no* extras.

**Bundle:** 16.9KB / 5.3KB gzipped, with 6.8KB of `.d.ts`.

**Trade-off:** Real implementations don't ship themes,
animations, or a11y beyond the basics. That's deferred — the
host app can swap any individual component via the React
component-types.

**Next:** PR 4 (`@playgenx/renderer`) consumes `componentMap`
to materialise TSX artifact bodies in browser environments.