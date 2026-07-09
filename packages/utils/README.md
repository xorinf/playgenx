# @playgenx/utils

Shared helpers for PlayGenX packages. No project-specific logic — just small
string utilities that are reused by the parser, validator, and registry.

## Helpers

- `tagNames(body: string): string[]` — extract capitalized JSX tag names,
  deduplicated. `tagNames('<Card><Text>x</Text></Card>')` → `['Card', 'Text']`.
- `hasBalancedTags(body: string): boolean` — naive `<X>...</X>` count match
  (case-insensitive, self-closing ignored). v0.1.0 is deliberately weak; real
  AST balancing lands in 0.2.0.
- `stripCodeComments(body: string): string` — strip `//` and `/* */` while
  preserving newlines so line numbers stay stable.
- `lineOfFirst(text: string, needle: string): number | undefined` — 1-indexed
  line of first occurrence.
