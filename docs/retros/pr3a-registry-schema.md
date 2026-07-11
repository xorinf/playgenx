---
tags: [retro, pr3a, registry, props]
pr: 3a
commit: d7c1801
---

# PR 3a — Prop-shape schema + jsx-props extractor

**What:** Lifted `DEFAULT_REGISTRY` from a list of names to a
list of `ComponentSchema`s (name + `props[]` with name/kind/
required). New helper `propsOfTag(body, name)` walks a TSX
opening tag and returns parsed props. Validator accepts an
opt-in `schemas` option that catches unknown props and missing
required props on registered components.

**Why:** The validator previously did name-only checks. A caller
who wrote `<Slider min={0} max={10} value="oops" />` (string
where number is required) only discovered the error at render
time. With schema validation, the error surfaces in the
`generateX` pipeline and `error.code === 'INVALID_JSON_SHAPE'` /
`'NON_DETERMINISTIC_EXPR'` already covers similar surface.

**Public API:**

```ts
const schemas: ComponentSchema[] = [
  { name: 'Button', props: [
    { name: 'label', kind: 'string', required: true },
    { name: 'disabled', kind: 'boolean' },
  ]},
];
const err = validate(body, undefined, { schemas });
```

`kind` is `'string' | 'number' | 'boolean' | 'node'`. `'node'`
accepts any expression — the renderer from PR 4 turns these into
`RenderExpression` placeholders.

**Behaviour:**

- Unknown props → rejected with `Unknown prop: <X foo>. Allowed:
  bar, baz`.
- Required prop missing → rejected with `Missing required prop
  \`min\` on <Slider>`.
- Wrong kind → rejected with `expected number, got expression`.
- Built-in HTML tags (`div`, `p`, …) are NOT schema-checked,
  regardless of `schemas` option. Schema check is registered-
  components-only.

**Bugs fixed during PR 3a:**

1. **`propsOfTag` infinite loop** on stray `/` between attributes.
   My first parsePropList had a `continue` branch that advanced
   zero positions. Fix: ensure every iteration of the outer
   `while` loop advances at least one character.

2. **`stripJsComments` masked string contents** (the existing
   helper). For prop extraction we needed to read the string
   values back out. Fixed with a state-machine scanner in
   `stripJsComments` (see PR 2 retro).

3. **`isBuiltInTag('SECTION')` returned true** because the old
   impl lowercased before lookup. Changed to exact-match against
   the lowercase set. PascalCase names go through the registry,
   not the HTML path.

**Tests:** 31 new. 11 jsx-props + 1 compound-word + 5 validator +
10 prop-shape end-to-end.

**Trade-off:** `schemas: []` is the opt-out (every component's
extra props are unchecked). Doesn't break backward compat —
existing callers see no change.

**Next:** PR 3b adds real React 19 implementations that satisfy
the schema; PR 4 reads them at runtime.