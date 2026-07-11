import { createRegistry } from './create.js';
import type { Registry, ComponentSchema } from './types.js';

/**
 * The default component registry. The validator allows any component in
 * this list, in addition to {@link BUILT_IN_TAGS}.
 */
export const DEFAULT_REGISTRY: Registry = createRegistry([
  'Button',
  'TextField',
  'Slider',
  'Chart',
  'Container',
  'Code',
  'Heading',
  'Text',
  'Stepper',
  'Card',
  'List',
]);

/**
 * Default prop-shape schemas for every component in {@link DEFAULT_REGISTRY}.
 *
 * Validator callers can pass this to a future `validateForKind(..., { schemas })`
 * option to get prop-shape checks instead of name-only checks. The
 * playground prompt template should align with these — every prop here
 * is documented as either required or optional with a default.
 *
 * Behavior is intentionally lenient: `kind: 'node'` props accept any
 * ReactNode including arbitrary strings; `kind: 'string'` accepts a
 * literal string literal in JSX. Numbers and booleans must look like
 * JS literals (`value={5}`, `disabled={true}`).
 */
export const DEFAULT_COMPONENT_SCHEMAS: readonly ComponentSchema[] = [
  {
    name: 'Button',
    acceptsChildren: false,
    props: [
      { name: 'label', kind: 'string', required: true, hint: 'Visible button text.' },
      { name: 'onClick', kind: 'node', hint: 'Handler. Ignored by the validator; renderer treats as a no-op.' },
      { name: 'disabled', kind: 'boolean' },
      { name: 'variant', kind: 'string', hint: '"primary" | "secondary" | "ghost"' },
    ],
  },
  {
    name: 'TextField',
    acceptsChildren: false,
    props: [
      { name: 'label', kind: 'string' },
      { name: 'value', kind: 'string' },
      { name: 'placeholder', kind: 'string' },
      { name: 'disabled', kind: 'boolean' },
      { name: 'onChange', kind: 'node' },
    ],
  },
  {
    name: 'Slider',
    acceptsChildren: false,
    props: [
      { name: 'min', kind: 'number', required: true },
      { name: 'max', kind: 'number', required: true },
      { name: 'value', kind: 'number' },
      { name: 'step', kind: 'number' },
      { name: 'label', kind: 'string' },
    ],
  },
  {
    name: 'Chart',
    acceptsChildren: false,
    props: [
      { name: 'kind', kind: 'string', required: true, hint: '"bar" | "line" | "pie"' },
      { name: 'data', kind: 'node', required: true, hint: 'JSON-shaped data; renderer parses.' },
      { name: 'title', kind: 'string' },
    ],
  },
  {
    name: 'Container',
    acceptsChildren: true,
    props: [
      { name: 'padding', kind: 'string', hint: 'CSS length, e.g. "16px".' },
      { name: 'gap', kind: 'string' },
    ],
  },
  {
    name: 'Code',
    acceptsChildren: true,
    props: [
      { name: 'language', kind: 'string' },
    ],
  },
  {
    name: 'Heading',
    acceptsChildren: true,
    props: [
      { name: 'level', kind: 'number', hint: '1..6; defaults to 2.' },
      { name: 'color', kind: 'string' },
    ],
  },
  {
    name: 'Text',
    acceptsChildren: true,
    props: [
      { name: 'weight', kind: 'string', hint: '"bold" | "normal"' },
      { name: 'size', kind: 'string', hint: 'CSS length.' },
      { name: 'color', kind: 'string' },
    ],
  },
  {
    name: 'Stepper',
    acceptsChildren: false,
    props: [
      { name: 'steps', kind: 'node', required: true, hint: 'Array-shaped data.' },
      { name: 'initial', kind: 'number' },
    ],
  },
  {
    name: 'Card',
    acceptsChildren: true,
    props: [
      { name: 'title', kind: 'string' },
      { name: 'elevation', kind: 'number' },
    ],
  },
  {
    name: 'List',
    acceptsChildren: true,
    props: [
      { name: 'items', kind: 'node' },
      { name: 'ordered', kind: 'boolean' },
    ],
  },
];

/**
 * Lookup helper. Given a schema array and a component name, returns the
 * matching schema or `null` if no entry exists. Used by the validator
 * when a caller opts into prop-shape checks.
 */
export function findSchema(
  name: string,
  schemas: readonly ComponentSchema[] = DEFAULT_COMPONENT_SCHEMAS,
): ComponentSchema | null {
  for (const s of schemas) {
    if (s.name === name) return s;
  }
  return null;
}

/**
 * Lowercase HTML tags the validator always allows. These are tags every
 * reasonable TSX/HTML output will use. Anything outside this set AND not
 * in {@link DEFAULT_REGISTRY} is rejected.
 */
export const BUILT_IN_TAGS: readonly string[] = [
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
];
