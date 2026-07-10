import { extractArtifact } from '@playgenx/parser';
import { DEFAULT_REGISTRY, type Registry } from '@playgenx/registry';
import { validateForKind } from '@playgenx/validators';
import type {
  ArtifactErrorCode,
  ArtifactRequest,
  ArtifactResult,
  Provider,
} from '@playgenx/types';

const DEFAULT_MAX_RESPONSE_BYTES = 200_000; // 200 KB

/**
 * What counts as a transient provider failure that should trigger an
 * automatic retry. A failure matching any of these gets retried with
 * exponential backoff up to `maxRetries` times. Permanent failures
 * (auth, malformed request, hard timeout, etc.) bubble up immediately.
 *
 * Note: a hard timeout (our own AbortController fired because the
 * request exceeded `timeoutMs`) is NOT treated as transient. The
 * retry would just hit the same timeout. The caller can retry
 * manually with a larger `timeoutMs`.
 */
export function isTransientProviderError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Network-level failures (Node fetch / undici).
  const code = (err as Error & { code?: string }).code;
  if (code) {
    if (
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNREFUSED' ||
      code === 'EAI_AGAIN' ||
      code === 'EPIPE' ||
      code === 'ENOTFOUND' ||
      code === 'UND_ERR_SOCKET'
    ) {
      return true;
    }
  }
  // OpenAI-style structured errors with an HTTP status. 429 and 5xx
  // are retryable; 4xx (other than 429) are caller errors.
  const status = (err as Error & { status?: number }).status;
  if (typeof status === 'number') {
    if (status === 429) return true;
    if (status >= 500 && status < 600) return true;
  }
  // AbortError from a user-provided AbortSignal IS transient (the user
  // can retry once they un-abort). But our OWN timeout abort (which we
  // identify by attaching a marker) is NOT.
  if (err.name === 'AbortError' && !(err as Error & { __playgenxTimeout?: boolean }).__playgenxTimeout) {
    return true;
  }
  return false;
}

/**
 * Mark an error as having come from our own timeout (not a user-supplied
 * AbortSignal). Callers use the `__playgenxTimeout` flag to distinguish:
 * user aborts are transient (they may un-abort and want us to retry);
 * our internal timeouts are not.
 */
export function markAsTimeoutError(err: unknown): unknown {
  if (err instanceof Error) {
    (err as Error & { __playgenxTimeout?: boolean }).__playgenxTimeout = true;
  }
  return err;
}

const DEFAULT_BACKOFF_BASE_MS = 250;
const DEFAULT_MAX_RETRIES = 2; // 3 total attempts (1 initial + 2 retries)
const DEFAULT_TIMEOUT_MS = 60_000; // 60s per attempt

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
   *
   * This is a post-hoc safety net — the LLM has already spent tokens
   * generating the truncated content. To cap token spend at the API
   * itself, set `maxTokens`.
   */
  readonly maxResponseBytes?: number;
  /**
   * Hard cap on output tokens. Passed to the provider's `complete()`
   * call as `maxTokens`; providers that support it (e.g. OpenAI) send
   * it as `max_tokens` so the model is stopped server-side before it
   * spends tokens we discard.
   *
   * Default: undefined (no cap; provider default applies). Setting this
   * is the recommended way to bound generation cost. Does NOT affect
   * response quality when set above the model's natural response size.
   */
  readonly maxTokens?: number;
  /**
   * Per-attempt timeout in milliseconds. The provider's `complete()`
   * call is aborted if it takes longer than this. Default 60s.
   *
   * Set to 0 to disable. A timeout is treated as a transient error
   * and counts toward `maxRetries` — the next attempt gets a fresh
   * budget.
   */
  readonly timeoutMs?: number;
  /**
   * Maximum number of retries on transient provider failures. Default 2
   * (so 3 total attempts). Set to 0 to disable retries entirely. Only
   * transient failures (network errors, 429, 5xx, timeout) are retried;
   * permanent failures (4xx other than 429) bubble up immediately.
   */
  readonly maxRetries?: number;
  /**
   * Base delay in milliseconds for exponential backoff between retries.
   * Actual delay is `baseMs * 2^attempt` plus up to 25% jitter. Default
   * 250ms.
   */
  readonly retryBaseMs?: number;
}

/**
 * Shared pipeline used by every `generateX` function. The only thing
 * that varies between kinds is the prompt template — the rest of the
 * pipeline (build prompt → provider call (with retries + timeout) →
 * truncate → extract → validate → return) is identical.
 */
async function runPipeline(
  request: ArtifactRequest,
  options: GenerateOptions,
  buildPrompt: (request: ArtifactRequest) => Promise<string>,
): Promise<ArtifactResult> {
  // Lazy import the prompts barrel so a single generateX call doesn't
  // pay the cost of loading every prompt template.
  const prompt = await buildPrompt(request);

  // 1) Provider call, with retries on transient failures and a per-
  //    attempt timeout.
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryBaseMs = options.retryBaseMs ?? DEFAULT_BACKOFF_BASE_MS;

  let raw: string | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      raw = await options.provider.complete(prompt, {
        model: options.model,
        maxTokens: options.maxTokens,
        timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
      });
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      if (!isTransientProviderError(err) || attempt >= maxRetries) break;
      // Exponential backoff with up to 25% jitter.
      const base = retryBaseMs * Math.pow(2, attempt);
      const jitter = base * 0.25 * (Math.random() * 2 - 1);
      const delayMs = Math.max(50, Math.floor(base + jitter));
      await sleep(delayMs);
    }
  }

  if (raw === undefined) {
    return {
      ok: false,
      error: {
        kind: request.kind,
        providerId: options.provider.id,
        stage: 'provider',
        code:
          lastErr && (lastErr as Error & { __playgenxTimeout?: boolean }).__playgenxTimeout
            ? 'TIMEOUT'
            : 'PROVIDER_ERROR',
        message: lastErr instanceof Error ? lastErr.message : String(lastErr),
      },
    };
  }

  // 2) Defensive: cap response size. A runaway LLM or hostile response
  //    shouldn't blow up the validator. We truncate at the FIRST fence
  //    boundary inside the budget so the parser still has a chance to
  //    find a balanced pair. If no fence fits, we add a closing fence
  //    ourselves.
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  let processed = raw;
  let truncated = false;
  if (maxBytes > 0 && raw.length > maxBytes) {
    processed = truncateWithFenceAwareness(raw, maxBytes);
    truncated = true;
  }

  // 3) Parse.
  const parsed = extractArtifact(processed);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        kind: request.kind,
        providerId: options.provider.id,
        stage: 'parse',
        code: parseErrorCode(parsed.error.message),
        message: parsed.error.message,
        line: parsed.error.line,
      },
    };
  }

  // 4) Validate. Use the kind-specific validator by default so JSON
  //    kinds get shape checks; allow callers to plug in their own.
  if (options.validate) {
    const validationError = options.validate(parsed.body);
    if (validationError !== null) {
      return {
        ok: false,
        error: {
          kind: request.kind,
          providerId: options.provider.id,
          stage: 'validate',
          code: 'INVALID_JSON_SHAPE',
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
          code: validatorErrorCode(built.message),
          message: built.message,
          line: built.line,
        },
      };
    }
  }

  // 5) Success. If we truncated, surface a warning so callers know
  //    the artifact body is incomplete (validator still ran; the
  //    artifact may or may not be valid for downstream rendering).
  return {
    ok: true,
    artifact: {
      kind: request.kind,
      body: parsed.body,
      providerId: options.provider.id,
      model: options.model ?? options.provider.defaultModel,
      ...(truncated ? { warning: 'Response was truncated by maxResponseBytes; artifact may be incomplete.' } : {}),
    },
  };
}

/**
 * Map a parse-error message to a stable error code. The parser returns
 * freeform strings; this keeps the code stable across releases.
 */
function parseErrorCode(message: string): ArtifactErrorCode {
  if (message.startsWith('Empty code fence')) return 'PARSE_EMPTY_FENCE';
  if (message.startsWith('Unbalanced code fence')) return 'PARSE_UNBALANCED_FENCE';
  return 'PARSE_NO_FENCE';
}

/**
 * Map a validator-error message to a stable error code. Freeform
 * strings remain the source of truth for humans; the code is for
 * programmatic branching.
 *
 * Substring matching is avoided where possible to keep this mapping
 * stable as new error messages are added. The forbidden-construct
 * detection uses `.includes` because there are four near-identical
 * messages (`` `eval(`is not allowed ``, `` `import`statements are not
 * allowed ``, `` `new Function(`is not allowed ``, `` `require(`is not
 * allowed ``); all share the FORBIDDEN_CONSTRUCT code.
 */
function validatorErrorCode(message: string): ArtifactErrorCode {
  if (message.startsWith('Body is not valid JSON')) return 'JSON_PARSE_FAILED';
  if (message.startsWith('Unbalanced JSX tags')) return 'UNBALANCED_TAGS';
  if (message.startsWith('Unknown component:')) return 'UNKNOWN_COMPONENT';
  if (
    message.includes('eval(') ||
    message.includes('new Function(') ||
    message.includes('import statements are not allowed') ||
    message.includes('require(')
  ) {
    return 'FORBIDDEN_CONSTRUCT';
  }
  return 'INVALID_JSON_SHAPE';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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