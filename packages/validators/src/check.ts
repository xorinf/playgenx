import { BUILT_IN_TAGS, DEFAULT_REGISTRY, type Registry } from '@playgenx/registry';
import {
  findNonDeterministic,
  hasBalancedTags,
  lineOfFirst,
  propsOfTag,
  stripCodeComments,
  tagNames,
} from '@playgenx/utils';
import type { ValidateOptions, ValidationError } from './types.js';

const BUILT_IN_SET = new Set(BUILT_IN_TAGS.map((t: string) => t.toLowerCase()));

/** Artifact kinds whose body should be valid JSON. */
const JSON_KINDS: ReadonlySet<string> = new Set(['poll', 'quiz', 'flashcards']);

/**
 * Required top-level fields and rough shape checks for each JSON kind.
 * Not a full schema - a smoke test for common LLM mistakes: missing
 * fields, wrong answer, duplicate IDs, non-object entries, etc.
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
    const optionIds = new Set<string>();
    for (let i = 0; i < p.options.length; i++) {
      const opt = p.options[i] as Record<string, unknown>;
      if (!opt || typeof opt !== 'object') {
        return `poll option ${i} is not an object`;
      }
      if (typeof opt.id !== 'string' || opt.id.length === 0) {
        return `poll option ${i} is missing ` + '`id`' + ` (must be a non-empty string)`;
      }
      if (optionIds.has(opt.id as string)) {
        return `poll has duplicate option ` + '`id`' + ` "${opt.id}"`;
      }
      optionIds.add(opt.id as string);
      if (typeof opt.label !== 'string') {
        return `poll option ${i} is missing ` + '`label`' + ` (must be a string)`;
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
    const seenQuestionIds = new Set<string>();
    for (let i = 0; i < q.questions.length; i++) {
      const qq = q.questions[i] as Record<string, unknown>;
      if (!qq || typeof qq !== 'object') {
        return `quiz question ${i} is not an object`;
      }
      if (typeof qq.id !== 'string' || qq.id.length === 0) {
        return `quiz question ${i} is missing ` + '`id`' + ` (must be a non-empty string)`;
      }
      if (seenQuestionIds.has(qq.id as string)) {
        return `quiz question ${i} has duplicate ` + '`id`' + ` "${qq.id}"`;
      }
      seenQuestionIds.add(qq.id as string);
      if (typeof qq.prompt !== 'string' || qq.prompt.length === 0) {
        return `quiz question ${i} is missing ` + '`prompt`';
      }
      if (!Array.isArray(qq.options) || qq.options.length < 2 || qq.options.length > 4) {
        return `quiz question ${i} must have between 2 and 4 options`;
      }
      const optionIds = new Set<string>();
      for (let j = 0; j < qq.options.length; j++) {
        const o = qq.options[j] as Record<string, unknown>;
        if (!o || typeof o !== 'object') {
          return `quiz q${i} option ${j} is not an object`;
        }
        if (typeof o.id !== 'string' || o.id.length === 0) {
          return `quiz q${i} option ${j} is missing ` + '`id`' + ` (must be a non-empty string)`;
        }
        if (optionIds.has(o.id as string)) {
          return `quiz q${i} has duplicate option ` + '`id`' + ` "${o.id}"`;
        }
        optionIds.add(o.id as string);
        if (typeof o.label !== 'string') {
          return `quiz q${i} option ${j} is missing ` + '`label`' + ` (must be a string)`;
        }
      }
      if (typeof qq.answer !== 'string' || (qq.answer as string).length === 0) {
        return `quiz question ${i} is missing ` + '`answer`' + ` (must be a non-empty string id)`;
      }
      if (!optionIds.has(qq.answer as string)) {
        return (
          `quiz question ${i}: ` + '`answer`' + ` ("${qq.answer}") doesn't match any option id`
        );
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
    const seenIds = new Set<string>();
    for (let i = 0; i < f.cards.length; i++) {
      const c = f.cards[i] as Record<string, unknown>;
      if (!c || typeof c !== 'object') {
        return `flashcard ${i} is not an object`;
      }
      if (typeof c.id !== 'string' || c.id.length === 0) {
        return `flashcard ${i} is missing ` + '`id`';
      }
      if (seenIds.has(c.id as string)) {
        return `flashcard ${i} has duplicate ` + '`id`' + ` "${c.id}"`;
      }
      seenIds.add(c.id as string);
      if (typeof c.front !== 'string' || c.front.length === 0) {
        return `flashcard ${i} is missing ` + '`front`';
      }
      if (typeof c.back !== 'string' || c.back.length === 0) {
        return `flashcard ${i} is missing ` + '`back`';
      }
    }
    return null;
  },
};

/**
 * Check a parsed artifact body for safety and registry membership.
 *
 * For JSON-bodied kinds (poll, quiz, flashcards), also verifies that
 * the body parses as JSON and roughly matches the expected shape.
 */
export function validate(
  body: string,
  registry: Registry = DEFAULT_REGISTRY,
  options: ValidateOptions = {},
): ValidationError | null {
  const stripped = stripCodeComments(body);

  // 1. No eval / new Function. Substring matching only - we never call
  //    eval() or construct a Function ourselves. The point is to reject
  //    artifact bodies that would themselves try to use them.
  const evalIdx = stripped.indexOf('eval(');
  if (evalIdx >= 0) {
    return { message: '`eval(`is not allowed in artifacts', line: lineOfFirst(stripped, 'eval(') };
  }
  const fnIdx = stripped.toLowerCase().indexOf('new function(');
  if (fnIdx >= 0) {
    const ln = lineOfFirst(stripped.toLowerCase(), 'new function(');
    return { message: '`new Function(`is not allowed in artifacts', line: ln };
  }

  // 2. No imports / requires.
  const importIdx = stripped.toLowerCase().indexOf('import ');
  if (importIdx >= 0) {
    return {
      message: '`import`statements are not allowed in artifacts',
      line: lineOfFirst(stripped.toLowerCase(), 'import '),
    };
  }
  const requireIdx = stripped.indexOf('require(');
  if (requireIdx >= 0) {
    return {
      message: '`require(`is not allowed in artifacts',
      line: lineOfFirst(stripped, 'require('),
    };
  }

  // 2b. No non-deterministic expressions. Only relevant for TSX
  //     bodies; JSON-bodied kinds skip this entire function and run
  //     the JSON shape check in `validateForKind` instead. Each
  //     prohibited token is a JS reference whose value depends on
  //     the moment of evaluation (Math.random, Date.now) or the
  //     runtime environment (window, globalThis, process) — both
  //     make a re-rendered artifact drift away from the original.
  //     We reject the BARE identifier inside JS expression contexts
  //     (`{...}` JSX expressions) and as standalone literals. To
  //     avoid false positives on substrings inside attribute names
  //     or string literals we strip strings + comments first.
  //
  //     Note: a future renderer could relax some of these if it
  //     implements deterministic-output mode (frozen clock, seeded
  //     PRNG). Until then, reject anything that would compromise it.
  const nonDeterministic = findNonDeterministic(stripped);
  if (nonDeterministic !== null) {
    return {
      message: `Non-deterministic expression \`${nonDeterministic}\` is not allowed in artifacts`,
      line: lineOfFirst(stripped, nonDeterministic),
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

  // 5. Optional prop-shape check. Only runs if the caller passed a
  //    `schemas` option AND the tag is in the registry (i.e. it's a
  //    known component, not a built-in HTML tag). Skipping for HTML
  //    tags keeps the validator's stance: HTML attributes are
  //    unrestricted by schema. The check confirms each prop the body
  //    declares is in the schema, that required props are present,
  //    and that the value's coarse kind matches the schema's spec.
  if (options.schemas && options.schemas.length > 0) {
    for (const schema of options.schemas) {
      const props = propsOfTag(body, schema.name);
      if (props.length === 0) continue;
      const allowed = new Set(schema.props.map((p) => p.name));
      const seen = new Set<string>();
      for (const p of props) {
        seen.add(p.name);
        if (!allowed.has(p.name)) {
          return {
            message: `Unknown prop: <${schema.name} ${p.name}>. Allowed: ${Array.from(allowed).join(', ') || '(none)'}`,
            line: lineOfFirst(body, `${p.name}=`),
          };
        }
        const spec = schema.props.find((s) => s.name === p.name);
        if (!spec) continue; // unreachable; defensive
        if (!isCompatibleKind(spec.kind, p.kind)) {
          return {
            message: `Invalid prop \`${p.name}\` on <${schema.name}>: expected ${spec.kind}, got ${p.kind}`,
            line: lineOfFirst(body, `${p.name}=`),
          };
        }
      }
      for (const spec of schema.props) {
        if (spec.required && !seen.has(spec.name)) {
          return {
            message: `Missing required prop \`${spec.name}\` on <${schema.name}>`,
            line: lineOfFirst(body, `<${schema.name}`),
          };
        }
      }
    }
  }

  return null;
}

/**
 * The validator's coarse-kind interpretation. `node` accepts any
 * expression (because the renderer cannot predict whether a reference
 * turns out to be a string, number, ReactNode, etc). `string` accepts
 * a quoted literal in source. `number` accepts a number literal or a
 * numeric-looking expression. `boolean` accepts `true`/`false` or a
 * bare attribute (which is shorthand for `true`).
 */
function isCompatibleKind(schemaKind: string, exprKind: string): boolean {
  if (schemaKind === 'node') return true;
  if (schemaKind === exprKind) return true;
  // Boolean shorthand: bare `<Button disabled />` is reported as kind
  // 'boolean' with value 'true', which matches schemaKind 'boolean'.
  if (schemaKind === 'boolean' && exprKind === 'expression') {
    // Bare `disabled={false}` would be expression/false; allow only
    // exact `true`/`false`. The classifier above already maps these
    // to kind 'boolean'. Other expressions are unsafe.
    return false;
  }
  return false;
}

/**
 * Validate a body for a specific artifact kind.
 *
 * For JSON-bodied kinds (poll, quiz, flashcards): parse the body as JSON
 * and run the kind-specific shape check. The base TSX validation
 * (tag balance, eval/import rejection, registry check) is SKIPPED for
 * these kinds — it's wasted work and produces worse error messages on
 * malformed JSON.
 *
 * For TSX-bodied kinds (playground, simulation, lab): run the base
 * validate() with the kind's JSX-balance policy applied.
 */
export function validateForKind(
  kind: string,
  body: string,
  registry: Registry = DEFAULT_REGISTRY,
  options: ValidateOptions = {},
): ValidationError | null {
  // JSON-bodied kinds: go straight to parse + shape check.
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
    const shapeErr = shapeCheck ? shapeCheck(parsed) : null;
    if (shapeErr) {
      return { message: shapeErr, line: 1 };
    }
    return null;
  }

  // TSX-bodied kinds: run the base validation (tag balance + safety +
  // registry check). For JSON kinds we already returned above, so this
  // path is exclusively for playground / simulation / lab.
  return validate(body, registry, {
    ...options,
    // JSON kinds always skip the JSX check; pass through the caller's
    // preference otherwise. We never reach here for JSON kinds, but the
    // setting is documented as the default for them.
    skipJsxCheck: options.skipJsxCheck ?? JSON_KINDS.has(kind),
  });
}
