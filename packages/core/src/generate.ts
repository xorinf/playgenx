import { extractArtifact } from '@playgenx/parser';
import { DEFAULT_REGISTRY, type Registry } from '@playgenx/registry';
import { validateForKind } from '@playgenx/validators';
import type {
  ArtifactRequest,
  ArtifactResult,
  Provider,
} from '@playgenx/types';

const DEFAULT_MAX_RESPONSE_BYTES = 200_000; // 200 KB

export interface GenerateOptions {
  /** Provider to call. Required — no default to keep behavior explicit. */
  readonly provider: Provider;
  /** Override the model the provider should use. */
  readonly model?: string;
  /**
   * Component registry. Defaults to {@link DEFAULT_REGISTRY}.
   * The validator uses this to decide which JSX tags are allowed.
   */
  readonly registry?: Registry;
  /**
   * Custom validator. Defaults to {@link validateForKind} from
   * @playgenx/validators. Return `null` on success, or a string with an
   * error message on failure.
   *
   * If you provide a custom validator, the kind-specific JSON shape
   * checks are bypassed. Set `validate` to a thin wrapper around
   * `validateForKind` if you want both.
   */
  readonly validate?: (body: string) => string | null;
  /**
   * Skip the JSX-tag balance check. Useful for JSON-bodied artifacts
   * (poll, quiz, flashcards) where the body is `{"question":"…"}` and
   * tag balancing is meaningless. Set automatically for JSON-bodied
   * kinds; this flag overrides that auto-detection.
   */
  readonly skipJsxCheck?: boolean;
  /**
   * Skip the kind-specific JSON shape check. Use only if you've already
   * validated the body yourself.
   */
  readonly skipJsonCheck?: boolean;
  /**
   * Maximum response body size in bytes. Default 200 KB. Responses
   * larger than this are truncated with a marker. Set to 0 to disable.
   */
  readonly maxResponseBytes?: number;
}

/**
 * Shared pipeline used by every `generateX` function. The only thing
 * that varies between kinds is the prompt template — the rest of the
 * pipeline (provider → parse → validate → return) is identical.
 */
async function runPipeline(
  request: ArtifactRequest,
  options: GenerateOptions,
  buildPrompt: (request: ArtifactRequest) => Promise<string>,
): Promise<ArtifactResult> {
  // Lazy import the prompts barrel so a single generateX call doesn't
  // pay the cost of loading every prompt template.
  const prompt = await buildPrompt(request);

  // 1) Provider call.
  let raw: string;
  try {
    raw = await options.provider.complete(prompt, { model: options.model });
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: request.kind,
        providerId: options.provider.id,
        stage: 'provider',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Defensive: cap response size. A runaway LLM or hostile response
  // shouldn't blow up the validator. We truncate at the FIRST fence
  // boundary inside the budget so the parser still has a chance to find
  // a balanced pair. If no fence fits, we add a closing fence ourselves.
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (maxBytes > 0 && raw.length > maxBytes) {
    raw = truncateWithFenceAwareness(raw, maxBytes);
  }

  // 2) Parse.
  const parsed = extractArtifact(raw);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        kind: request.kind,
        providerId: options.provider.id,
        stage: 'parse',
        message: parsed.error.message,
        line: parsed.error.line,
      },
    };
  }

  // 3) Validate. Use the kind-specific validator by default so JSON
  // kinds get shape checks; allow callers to plug in their own.
  if (options.validate) {
    const validationError = options.validate(parsed.body);
    if (validationError !== null) {
      return {
        ok: false,
        error: {
          kind: request.kind,
          providerId: options.provider.id,
          stage: 'validate',
          message: validationError,
        },
      };
    }
  } else {
    const registry = options.registry ?? DEFAULT_REGISTRY;
    const built = validateForKind(request.kind, parsed.body, registry, {
      skipJsxCheck: options.skipJsxCheck,
      skipJsonCheck: options.skipJsonCheck,
    });
    if (built) {
      return {
        ok: false,
        error: {
          kind: request.kind,
          providerId: options.provider.id,
          stage: 'validate',
          message: built.message,
          line: built.line,
        },
      };
    }
  }

  return {
    ok: true,
    artifact: {
      kind: request.kind,
      body: parsed.body,
      providerId: options.provider.id,
      model: options.model ?? options.provider.defaultModel,
    },
  };
}

// Lazy prompt resolvers. We can't statically import the prompts because
// each generateX call only needs one prompt template, and bundling all
// of them would inflate the published output.

async function loadPrompts(): Promise<typeof import('@playgenx/prompts')> {
  return import('@playgenx/prompts');
}

/**
 * Truncate a raw LLM response to fit within `maxBytes`, preserving fence
 * structure if possible. The parser needs a balanced ``` pair to extract
 * a body; if we just chop the middle, the parser will fail with
 * "unbalanced fence". So:
 *   1. Find the first opening fence within the budget.
 *   2. Find the next closing fence after that.
 *   3. If both fit, keep the content up to the closing fence and append
 *      a truncation marker INSIDE the fence (so the parser sees it).
 *   4. Otherwise, fall back to cutting at the budget and inserting a
 *      closing fence + marker.
 */
function truncateWithFenceAwareness(raw: string, maxBytes: number): string {
  const FENCE_LEN = 3; // ```
  const SLACK = 256; // room for the closing fence + truncation marker
  const head = raw.slice(0, Math.max(0, maxBytes - SLACK));
  const TRUNC_MARKER = '\n/* [playgenx: response truncated] */';

  // Find the first ``` at start of line within `head`.
  const fenceRe = /(?:^|\n)([ \t]*```)/g;
  fenceRe.lastIndex = 0;
  const m = fenceRe.exec(head);
  if (!m) {
    // No fence in the budget. Append a closing fence + marker. The
    // marker goes BEFORE the closing fence so the parser includes it
    // in the body.
    return head + TRUNC_MARKER + '\n```';
  }
  const fenceStart = m.index + (m[0]!.startsWith('\n') ? 1 : 0);
  // Find the next ``` after the opening one.
  const closeIdx = head.indexOf('\n```', fenceStart + FENCE_LEN);
  if (closeIdx > 0 && closeIdx + FENCE_LEN + 1 < maxBytes) {
    // Closing fence fits. Truncate at the line after the closing fence,
    // with the marker INSIDE the fence so the parser preserves it.
    return head.slice(0, closeIdx + 1) + TRUNC_MARKER + '\n```';
  }
  // No closing fence inside the budget. Just append one.
  return head + TRUNC_MARKER + '\n```';
}

/**
 * Generate an interactive playground artifact (TSX/HTML body).
 *
 * Body shape: a self-contained interactive component the caller can render.
 */
export async function generatePlayground(
  request: ArtifactRequest,
  options: GenerateOptions,
): Promise<ArtifactResult> {
  return runPipeline(request, options, async (req) => {
    const prompts = await loadPrompts();
    return prompts.playgroundPrompt(req);
  });
}

/**
 * Generate a single-question poll with 2-4 options.
 *
 * Body shape: JSON string of the form
 * `{ "question": "...", "options": [{ "id": "a", "label": "..." }, ...] }`.
 */
export async function generatePoll(
  request: ArtifactRequest,
  options: GenerateOptions,
): Promise<ArtifactResult> {
  return runPipeline(
    { ...request, kind: 'poll' },
    options,
    async (req) => {
      const prompts = await loadPrompts();
      return prompts.pollPrompt(req);
    },
  );
}

/**
 * Generate a multi-question quiz with answers.
 *
 * Body shape: JSON string of the form
 * `{ "questions": [{ "id": "q1", "prompt": "...", "options": [...], "answer": "b" }, ...] }`.
 */
export async function generateQuiz(
  request: ArtifactRequest,
  options: GenerateOptions,
): Promise<ArtifactResult> {
  return runPipeline(
    { ...request, kind: 'quiz' },
    options,
    async (req) => {
      const prompts = await loadPrompts();
      return prompts.quizPrompt(req);
    },
  );
}

/**
 * Generate an interactive simulation artifact.
 *
 * Body shape: TSX/HTML — a self-contained component with state and step logic.
 */
export async function generateSimulation(
  request: ArtifactRequest,
  options: GenerateOptions,
): Promise<ArtifactResult> {
  return runPipeline(request, options, async (req) => {
    const prompts = await loadPrompts();
    return prompts.simulationPrompt(req);
  });
}

/**
 * Generate a deck of flashcards.
 *
 * Body shape: JSON string of the form
 * `{ "cards": [{ "id": "c1", "front": "...", "back": "..." }, ...] }`.
 */
export async function generateFlashcards(
  request: ArtifactRequest,
  options: GenerateOptions,
): Promise<ArtifactResult> {
  return runPipeline(
    { ...request, kind: 'flashcards' },
    options,
    async (req) => {
      const prompts = await loadPrompts();
      return prompts.flashcardsPrompt(req);
    },
  );
}

/**
 * Generate a guided lab — a multi-step exploration with hints and a final check.
 *
 * Body shape: TSX/HTML — a self-contained component that walks a learner through steps.
 */
export async function generateLab(
  request: ArtifactRequest,
  options: GenerateOptions,
): Promise<ArtifactResult> {
  return runPipeline(request, options, async (req) => {
    const prompts = await loadPrompts();
    return prompts.labPrompt(req);
  });
}