import { BUILT_IN_TAGS, DEFAULT_REGISTRY, type Registry } from '@playgenx/registry';
import { hasBalancedTags, lineOfFirst, stripCodeComments, tagNames } from '@playgenx/utils';
import type { ValidateOptions, ValidationError } from './types.js';

const BUILT_IN_SET = new Set(BUILT_IN_TAGS.map((t: string) => t.toLowerCase()));

/** Artifact kinds whose body should be valid JSON. */
const JSON_KINDS: ReadonlySet<string> = new Set(['poll', 'quiz', 'flashcards']);

/**
 * Required top-level fields and rough shape checks for each JSON kind.
 * This isn't a full schema — it's a smoke test to catch the common
 * LLM mistakes (missing `question`, wrong `answer` field, etc).
 */
const JSON_KIND_SHAPES: Readonly<Record<string, (parsed: unknown) => string | null>> = {
  poll: (parsed) => {
    if (!parsed || typeof parsed !== 'object') return 'expected a JSON object';
    const p = parsed as Record<string, unknown>;
    if (typeof p.question !== 'string' || p.question.length === 0) {
      return 'poll is missing `question` (must be a non-empty string)';
    }
    if (!Array.isArray(p.options)) return 'poll is missing `options` (must be an array)';
    if (p.options.length < 2 || p.options.length > 4) {
      return `poll must have between 2 and 4 options (got ${p.options.length})`;
    }
    for (let i = 0; i < p.options.length; i++) {
      const opt = p.options[i] as Record<string, unknown>;
      if (typeof opt.id !== 'string' || opt.id.length === 0) {
        return `poll option ${i} is missing \`id\` (must be a non-empty string)`;
      }
      if (typeof opt.label !== 'string') {
        return `poll option ${i} is missing \`label\` (must be a string)`;
      }
    }
    return null;
  },
  quiz: (parsed) => {
    if (!parsed || typeof parsed !== 'object') return 'expected a JSON object';
    const q = parsed as Record<string, unknown>;
    if (!Array.isArray(q.questions)) return 'quiz is missing `questions` (must be an array)';
    if (q.questions.length < 3 || q.questions.length > 8) {
      return `quiz must have between 3 and 8 questions (got ${q.questions.length})`;
    }
    const optionIds = new Set<string>();
    for (let i = 0; i < q.questions.length; i++) {
      const qq = q.questions[i] as Record<string, unknown>;
      if (typeof qq.id !== 'string' || qq.id.length === 0) {
        return `quiz question ${i} is missing \`id\` (must be a non-empty string)`;
      }
      if (typeof qq.prompt !== 'string' || qq.prompt.length === 0) {
        return `quiz question ${i} is missing \`prompt\``;
      }
      if (!Array.isArray(qq.options) || qq.options.length < 2 || qq.options.length > 4) {
        return `quiz question ${i} must have between 2 and 4 options`;
      }
      for (let j = 0; j < qq.options.length; j++) {
        const o = qq.options[j] as Record<string, unknown>;
        if (typeof o.id !== 'string') return `quiz q${i} option ${j} missing id`;
        optionIds.add(o.id);
      }
      if (typeof qq.answer !== 'string') {
        return `quiz question ${i} is missing \`answer\` (must be a string id)`;
      }
      if (!optionIds.has(qq.answer as string)) {
        return `quiz question ${i}: \`answer\` ("${qq.answer}") doesn't match any option id`;
      }
    }
    return null;
  },
  flashcards: (parsed) => {
    if (!parsed || typeof parsed !== 'object') return 'expected a JSON object';
    const f = parsed as Record<string, unknown>;
    if (!Array.isArray(f.cards)) return 'flashcards is missing `cards` (must be an array)';
    if (f.cards.length < 5 || f.cards.length > 20) {
      return `flashcards deck must have between 5 and 20 cards (got ${f.cards.length})`;
    }
    for (let i = 0; i < f.cards.length; i++) {
      const c = f.cards[i] as Record<string, unknown>;
      if (typeof c.id !== 'string' || c.id.length === 0) {
        return `flashcard ${i} is missing \`id\``;
      }
      if (typeof c.front !== 'string' || c.front.length === 0) {
        return `flashcard ${i} is missing \`front\``;
      }
      if (typeof c.back !== 'string' || c.back.length === 0) {
        return `flashcard ${i} is missing \`back\``;
      }
    }
    return null;
  },
};

export interface ValidateOptions {
  /**
   * Skip the JSX-tag balance check. Use for JSON-bodied artifacts
   * (poll, quiz, flashcards) where the body is parsed as data, not
   * rendered as TSX.
   */
  readonly skipJsxCheck?: boolean;
  /**
   * Skip the JSON-shape check for JSON-bodied artifacts. Use this only
   * if you've already validated the body yourself with a stricter schema.
   */
  readonly skipJsonCheck?: boolean;
}

/**
 * Check a parsed artifact body for safety and registry membership.
 *
 * For JSON-bodied kinds (poll, quiz, flashcards), also verifies that
 * the body parses as JSON and roughly matches the expected shape. This
 * catches common LLM mistakes (missing fields, wrong `answer`, etc.)
 * before the caller has to deal with them.
 */
export function validate(
  body: string,
  registry: Registry = DEFAULT_REGISTRY,
  options: ValidateOptions = {},
): ValidationError | null {
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

  // 3. Roughly balanced tags. Skipped for JSON-bodied kinds.
  if (!options.skipJsxCheck && !hasBalancedTags(body)) {
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

/**
 * Validate a body for a specific artifact kind. Extends {@link validate}
 * with kind-specific JSON shape checks for poll/quiz/flashcards.
 *
 * Use this from the core pipeline; user-facing validators can stick
 * with {@link validate} for TSX bodies.
 */
export function validateForKind(
  kind: string,
  body: string,
  registry: Registry = DEFAULT_REGISTRY,
  options: ValidateOptions = {},
): ValidationError | null {
  // 1-4: same as validate().
  const baseError = validate(body, registry, {
    ...options,
    // JSON kinds always skip the JSX check; pass through otherwise.
    skipJsxCheck: options.skipJsxCheck ?? JSON_KINDS.has(kind),
  });
  if (baseError) return baseError;

  // 5. JSON shape check (only for JSON kinds, unless explicitly skipped).
  if (JSON_KINDS.has(kind) && !options.skipJsonCheck) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      return {
        message: `Body is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
        line: 1,
      };
    }
    const shapeCheck = JSON_KIND_SHAPES[kind];
    if (shapeCheck) {
      const shapeErr = shapeCheck(parsed);
      if (shapeErr) {
        return { message: shapeErr, line: 1 };
      }
    }
  }

  return null;
}