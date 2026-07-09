import { createRegistry } from './create.js';
import type { Registry } from './types.js';

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
