import { extractArtifact } from '@playgenx/parser';
import { DEFAULT_REGISTRY, type Registry } from '@playgenx/registry';
import { sha256Hex, utf8ByteLength } from '@playgenx/utils';
import { validateForKind } from '@playgenx/validators';
import { estimateCostFor } from '@playgenx/providers';
import { getTracer, NOOP_SPAN, type OTelSpanLike } from '@playgenx/observability';
import type {
  ArtifactErrorCode,
  ArtifactRequest,
  ArtifactResult,
  Provider,
  ProviderResult,
  TokenUsage,
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
  if (
    err.name === 'AbortError' &&
    !(err as Error & { __playgenxTimeout?: boolean }).__playgenxTimeout
  ) {
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
  /**
   * How many times to retry the *provider call* if the validator
   * rejects the body, each time appending the validator's message
   * to the prompt. Defaults to 1 (the v0.4 P0 default). Set to 0 to
   * disable the correction loop.
   */
  readonly maxValidationRetries?: number;
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
  let lastUsage: TokenUsage | undefined;
  let totalAttempts = 0;
  const tracer = getTracer();
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    totalAttempts++;
    const span: OTelSpanLike = tracer
      ? tracer.startSpan('gen_ai.chat', {
          attributes: {
            'gen_ai.system': options.provider.id,
            'gen_ai.request.model': options.model ?? options.provider.defaultModel,
            'gen_ai.operation.name': 'generate',
          },
        })
      : NOOP_SPAN;
    try {
      const result = await options.provider.complete(prompt, {
        model: options.model,
        maxTokens: options.maxTokens,
        timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
      });
      raw = result.body;
      lastUsage = result.usage;
      lastErr = undefined;
      span.setStatus({ code: 'ok' });
      span.end();
      break;
    } catch (err) {
      lastErr = err;
      span.recordException(err);
      // Clamp the message to 4 KB. OTel exporters (OTLP, Jaeger) reject
      // attribute values over their per-attribute limits, and a model
      // error message can be unboundedly long. The truncation marker
      // keeps it grep-able.
      const rawMsg = err instanceof Error ? err.message : String(err);
      const SPAN_MSG_MAX = 4_000;
      const spanMsg =
        rawMsg.length > SPAN_MSG_MAX
          ? `${rawMsg.slice(0, SPAN_MSG_MAX)}…[truncated]`
          : rawMsg;
      span.setStatus({ code: 'error', message: spanMsg });
      span.end();
      if (!isTransientProviderError(err) || attempt >= maxRetries) break;
      // Exponential backoff with up to 25% jitter.
      const base = retryBaseMs * Math.pow(2, attempt);
      const jitter = base * 0.25 * (Math.random() * 2 - 1);
      const delayMs = Math.max(50, Math.floor(base + jitter));
      await sleep(delayMs);
    }
  }

  if (raw === undefined) {
    const lastWasTimeout =
      lastErr !== null && lastErr !== undefined && (lastErr as Error & { __playgenxTimeout?: boolean }).__playgenxTimeout;
    // Distinguish "we tried N times and gave up" (RETRIES_EXHAUSTED)
    // from "the provider told us no" (PROVIDER_ERROR). Without this
    // split, callers can't tell whether to surface "please retry" UX
    // vs "your request was rejected" UX — the latter usually means a
    // config error (bad API key, wrong model name) that retrying won't
    // fix.
    //
    // Heuristic: if the last error was transient AND we hit the
    // retry cap, emit RETRIES_EXHAUSTED. Permanent failures and
    // immediate aborts (timeout on first attempt) stay PROVIDER_ERROR.
    const wasLastErrorTransient = lastErr ? isTransientProviderError(lastErr) : false;
    const exhaustedRetries = wasLastErrorTransient && totalAttempts >= maxRetries + 1;
    return {
      ok: false,
      error: {
        kind: request.kind,
        providerId: options.provider.id,
        stage: 'provider',
        code: lastWasTimeout
          ? 'TIMEOUT'
          : exhaustedRetries
            ? 'RETRIES_EXHAUSTED'
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
  //
  //    NOTE: maxResponseBytes is a UTF-8 byte budget, not a UTF-16
  //    code-unit budget. We use `utf8ByteLength` rather than
  //    `raw.length` because emoji and other supplementary-plane
  //    characters would otherwise push `length` over the cap while
  //    `byteLength` is still well under it. See M4 in the integrity
  //    audit notes.
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  let processed = raw;
  let truncated = false;
  if (maxBytes > 0 && utf8ByteLength(raw) > maxBytes) {
    processed = truncateWithFenceAwareness(raw, maxBytes);
    truncated = true;
  }

  // 3) Parse.
  const extractSpan: OTelSpanLike = tracer
    ? tracer.startSpan('pgx.extract', { attributes: { 'pgx.kind': request.kind } })
    : NOOP_SPAN;
  const parsed = extractArtifact(processed);
  extractSpan.setStatus({
    code: parsed.ok ? 'ok' : 'error',
    message: parsed.ok ? undefined : parsed.error.message,
  });
  extractSpan.end();
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
  //
  //    Auto-retry-with-correction: when the validator returns an
  //    error and `maxValidationRetries > 0`, we call the provider
  //    once more with the validator's message appended to the prompt.
  //    Default is 1 retry, matching the P0 in the v0.4 roadmap.
  const maxValidationRetries = options.maxValidationRetries ?? 1;
  let validation: { ok: true } | { ok: false; message: string } = { ok: true };
  let validationErr: { message: string; line?: number } | null = null;
  let attemptCount = 0;
  // We need a mutable closure over `parsed` for the retry loop.
  let currentBody = parsed.body;
  // Thread usage from the most recent successful provider call
  // forward. When validation retries, the retry call overwrites
  // these; on success we use whichever call produced the accepted
  // body.
  //
  // finishReason is intentionally captured only for telemetry —
  // surfaced via the OTel span below, not stored on the Artifact.
  // Adding it to the public Artifact type would expand the public
  // surface area for marginal value; revisit if callers ask.
  let currentUsage: TokenUsage | undefined = lastUsage;
  // `bodyId` and `promptFp` are computed from the FINAL accepted body.
  let lastPrompt = prompt;
  for (; attemptCount <= maxValidationRetries; attemptCount++) {
    const validateSpan: OTelSpanLike = tracer
      ? tracer.startSpan('pgx.validate', { attributes: { 'pgx.kind': request.kind } })
      : NOOP_SPAN;
    if (options.validate) {
      const msg = options.validate(currentBody);
      if (msg === null) {
        validation = { ok: true };
        validateSpan.setStatus({ code: 'ok' });
        validateSpan.end();
        break;
      }
      validation = { ok: false, message: msg };
      validationErr = { message: msg };
      validateSpan.setStatus({ code: 'error', message: msg });
      validateSpan.end();
    } else {
      const registry = options.registry ?? DEFAULT_REGISTRY;
      const built = validateForKind(request.kind, currentBody, registry, {
        skipJsxCheck: options.skipJsxCheck,
        skipJsonCheck: options.skipJsonCheck,
      });
      if (!built) {
        validation = { ok: true };
        validateSpan.setStatus({ code: 'ok' });
        validateSpan.end();
        break;
      }
      validation = { ok: false, message: built.message };
      validationErr = { message: built.message, line: built.line };
      validateSpan.setStatus({ code: 'error', message: built.message });
      validateSpan.end();
    }
    // If we have retries left, ask the provider to try again with
    // the validator message appended. Continue the loop with the
    // new body.
    if (attemptCount < maxValidationRetries) {
      const retrySpan: OTelSpanLike = tracer
        ? tracer.startSpan('gen_ai.chat', {
            attributes: {
              'gen_ai.system': options.provider.id,
              'gen_ai.request.model': options.model ?? options.provider.defaultModel,
              'gen_ai.operation.name': 'generate.retry',
              'pgx.retry.reason': 'validator',
            },
          })
        : NOOP_SPAN;
      const correctionPrompt =
        lastPrompt +
        '\n\n[Validator feedback — your previous response was rejected. ' +
        'Please fix and return again]:\n' +
        validationErr.message;
      try {
        const retryResult: ProviderResult = await options.provider.complete(correctionPrompt, {
          model: options.model,
          maxTokens: options.maxTokens,
          timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
        });
        const retried = retryResult.body;
        // Truncate to the same UTF-8 byte cap as the initial response.
        // See M4 in the integrity audit notes.
        const truncated =
          maxBytes > 0 && utf8ByteLength(retried) > maxBytes
            ? truncateWithFenceAwareness(retried, maxBytes)
            : retried;
        const reParsed = extractArtifact(truncated);
        retrySpan.setStatus({ code: reParsed.ok ? 'ok' : 'error' });
        retrySpan.end();
        if (!reParsed.ok) {
          // Give up — surface the original validation error.
          break;
        }
        currentBody = reParsed.body;
        // Only adopt the retry's usage when the retry body is the one
        // we're going to ship. If validation later rejects this too and
        // we don't get to attempt N+1, the failure path stays decoupled
        // from the provider metadata.
        currentUsage = retryResult.usage;
        lastPrompt = correctionPrompt;
      } catch {
        retrySpan.setStatus({ code: 'error' });
        retrySpan.end();
        break;
      }
    }
  }
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        kind: request.kind,
        providerId: options.provider.id,
        stage: 'validate',
        code: validatorErrorCode(validationErr?.message ?? 'unknown'),
        message: validationErr?.message ?? 'validation failed',
        line: validationErr?.line,
      },
    };
  }

  // 5) Success. If we truncated, surface a warning so callers know
  //    the artifact body is incomplete (validator still ran; the
  //    artifact may or may not be valid for downstream rendering).
  //
  //    The two additive fingerprint fields are computed here so
  //    callers can drive cache invalidation without re-running the
  //    validator. Both are optional on `Artifact`; we attach them
  //    on every successful generation so consumers never have to
  //    branch on `if (result.artifact.id)`.
  //
  //    v0.4: also attach `usage` (when the provider supplied token
  //    counts) and `costUsd` (computed from the pricing table).
  //
  //    `currentUsage` is threaded through the validation retry loop
  //    so it survives parsing and truncation. The previous
  //    implementation looked up usage via a global Map keyed by the
  //    raw response body — which silently returned `undefined`
  //    whenever the parser trimmed or mutated the body (the canonical
  //    fenced-code-block case). See integrity-audit notes for C1.
  const bodyId = await sha256Hex(`${request.kind}|${options.provider.id}|${currentBody}`);
  const promptFp = await sha256Hex(
    `${request.kind}|${request.context}|${request.concept}|${prompt}`,
  );
  const finalModel = options.model ?? options.provider.defaultModel;
  const finalCost =
    currentUsage && finalModel ? estimateCostFor(finalModel, currentUsage) : undefined;
  return {
    ok: true,
    artifact: {
      kind: request.kind,
      body: currentBody,
      providerId: options.provider.id,
      model: finalModel,
      id: bodyId,
      promptFingerprint: promptFp,
      ...(currentUsage ? { usage: currentUsage } : {}),
      ...(finalCost !== undefined ? { costUsd: finalCost } : {}),
      ...(truncated
        ? { warning: 'Response was truncated by maxResponseBytes; artifact may be incomplete.' }
        : {}),
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
  if (message.startsWith('Non-deterministic expression')) {
    return 'NON_DETERMINISTIC_EXPR';
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
 *
 * The `maxBytes` budget is in UTF-8 bytes, but the inner `slice` and
 * index operations work in UTF-16 code units. This is an intentional
 * approximation: when we get here we're already past the byte cap and
 * the goal is to produce something the parser can extract, not to
 * hit the byte cap exactly. Over-truncating (which is what code-unit
 * slicing does on strings with supplementary-plane characters) is the
 * safer outcome — the truncation marker is appended regardless. The
 * outer byte-length check (in `runPipeline`) is what decides whether
 * truncation is needed at all; that one is exact.
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
  return runPipeline({ ...request, kind: 'poll' }, options, async (req) => {
    const prompts = await loadPrompts();
    return prompts.pollPrompt(req);
  });
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
  return runPipeline({ ...request, kind: 'quiz' }, options, async (req) => {
    const prompts = await loadPrompts();
    return prompts.quizPrompt(req);
  });
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
  return runPipeline({ ...request, kind: 'flashcards' }, options, async (req) => {
    const prompts = await loadPrompts();
    return prompts.flashcardsPrompt(req);
  });
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
