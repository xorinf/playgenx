import { BUILT_IN_TAGS, DEFAULT_REGISTRY, type Registry } from '@playgenx/registry';
import { hasBalancedTags, lineOfFirst, stripCodeComments, tagNames } from '@playgenx/utils';
import type { ValidationError } from './types.js';

const BUILT_IN_SET = new Set(BUILT_IN_TAGS.map((t: string) => t.toLowerCase()));

/**
 * Check a parsed artifact body for safety and registry membership.
 *
 * v0.1.0 checks (in order — first failure is returned):
 *
 * 1. No `eval(` and no `new Function(` substrings (after comment-stripping).
 * 2. No `import ` or `require(` (after comment-stripping).
 * 3. JSX-style tags are roughly balanced.
 * 4. Every capitalized component tag is in `registry` (default:
 *    {@link DEFAULT_REGISTRY}) or in the lowercase built-in set
 *    ({@link BUILT_IN_TAGS}).
 *
 * Limitations (to be addressed in 0.2.0):
 *
 * - Substring checks (1) and (2) can have false positives on strings inside
 *   code. Comment-stripping helps but does not eliminate the issue.
 * - Tag balancing (3) is naive — see {@link hasBalancedTags}.
 * - No real AST parsing.
 *
 * @param body - The artifact body, post-parser.
 * @param registry - Optional component allowlist. Defaults to {@link DEFAULT_REGISTRY}.
 * @returns A {@link ValidationError} on failure, or `null` on success.
 */
export function validate(body: string, registry: Registry = DEFAULT_REGISTRY): ValidationError | null {
  const stripped = stripCodeComments(body);

  // 1. No eval / new Function.
  const evalIdx = stripped.indexOf('eval(');
  if (evalIdx >= 0) {
    return { message: '`eval(` is not allowed in artifacts', line: lineOfFirst(stripped, 'eval(') };
  }
  const fnIdx = stripped.toLowerCase().indexOf('new function(');
  if (fnIdx >= 0) {
    const ln = lineOfFirst(stripped.toLowerCase(), 'new function(');
    return { message: '`new Function(` is not allowed in artifacts', line: ln };
  }

  // 2. No imports / requires.
  const importIdx = stripped.toLowerCase().indexOf('import ');
  if (importIdx >= 0) {
    return {
      message: '`import` statements are not allowed in artifacts',
      line: lineOfFirst(stripped.toLowerCase(), 'import '),
    };
  }
  const requireIdx = stripped.indexOf('require(');
  if (requireIdx >= 0) {
    return {
      message: '`require(` is not allowed in artifacts',
      line: lineOfFirst(stripped, 'require('),
    };
  }

  // 3. Roughly balanced tags.
  if (!hasBalancedTags(body)) {
    return { message: 'Unbalanced JSX tags', line: 1 };
  }

  // 4. Every capitalized tag is in the registry or the built-in set.
  for (const tag of tagNames(body)) {
    if (registry.isAllowed(tag)) continue;
    if (BUILT_IN_SET.has(tag.toLowerCase())) continue;
    return {
      message: `Unknown component: ${tag}. Add it to your registry or use a built-in HTML tag.`,
      line: lineOfFirst(body, `<${tag}`),
    };
  }

  return null;
}
