/**
 * Shared types for PlayGenX packages.
 *
 * No business logic. Pure type definitions and small data carriers.
 *
 * @packageDocumentation
 */

/** Kinds of educational artifacts PlayGenX can produce. */
export type ArtifactKind =
  | 'playground'
  | 'poll'
  | 'quiz'
  | 'simulation'
  | 'flashcards'
  | 'lab';

/** Input to artifact generation: lecture context plus the target kind. */
export interface ArtifactRequest {
  /** Free-form lecture context. Transcript, notes, concept — whatever the caller has. */
  readonly context: string;
  /** The specific concept or topic the artifact should focus on. */
  readonly concept: string;
  /** Target artifact kind. */
  readonly kind: ArtifactKind;
  /** Optional caller-provided prompt override; merged with the default template. */
  readonly promptOverride?: string;
}

/** Successful generation result. */
export interface Artifact {
  readonly kind: ArtifactKind;
  /** Provider-agnostic body — what the artifact *is*. */
  readonly body: string;
  /** Which provider produced it. */
  readonly providerId: string;
  /** Model identifier inside the provider, e.g. `gpt-4o-mini`. */
  readonly model: string;
  /**
   * Optional non-fatal warning. Currently emitted when the response
   * was truncated by `maxResponseBytes`. The artifact is still returned
   * — the caller may decide to retry with a larger budget.
   */
  readonly warning?: string;
}

/** Pipeline stage that produced an error. */
export type ArtifactErrorStage = 'prompt' | 'provider' | 'parse' | 'validate';

/** Failure result from any pipeline stage. */
export interface ArtifactError {
  readonly kind: ArtifactKind;
  /** Which provider produced the error, when known. Always set for errors
   * from the provider or later stages; `undefined` only for prompt-build
   * errors (which never reach a provider). */
  readonly providerId?: string;
  /** Which pipeline stage produced the error. */
  readonly stage: ArtifactErrorStage;
  readonly message: string;
  /** Optional line number inside the artifact body, if applicable. */
  readonly line?: number;
  /** Optional machine-readable error code. */
  readonly code?: ArtifactErrorCode;
}

/**
 * Machine-readable error codes. New codes should be added when callers
 * need to branch programmatically on error types (vs. matching on the
 * human-readable `message`). All error objects carry this as `code`;
 * legacy callers that only read `message` keep working.
 */
export type ArtifactErrorCode =
  /** The LLM provider's `complete()` call threw (network, 5xx, etc.). */
  | 'PROVIDER_ERROR'
  /** Provider returned 200 but the response body was truncated to fit `maxResponseBytes`. */
  | 'RESPONSE_TRUNCATED'
  /** extractArtifact could not find a balanced fenced code block. */
  | 'PARSE_NO_FENCE'
  /** The fenced code block existed but had empty content. */
  | 'PARSE_EMPTY_FENCE'
  /** The code fence was opened but never closed. */
  | 'PARSE_UNBALANCED_FENCE'
  /** The body is not valid JSON (JSON-bodied kinds only). */
  | 'JSON_PARSE_FAILED'
  /** The body is valid JSON but does not match the kind's shape. */
  | 'INVALID_JSON_SHAPE'
  /** JSX tag balance check failed (TSX-bodied kinds only). */
  | 'UNBALANCED_TAGS'
  /** A capitalized tag is not in the registry and not a built-in HTML element. */
  | 'UNKNOWN_COMPONENT'
  /** The body contains a forbidden construct (eval / new Function / import / require). */
  | 'FORBIDDEN_CONSTRUCT'
  /** Generation timed out before the provider returned a response. */
  | 'TIMEOUT'
  /** Exceeded `maxRetries` on transient provider failures. */
  | 'RETRIES_EXHAUSTED';

/** Discriminated union returned by `generateX` functions. */
export type ArtifactResult = { ok: true; artifact: Artifact } | { ok: false; error: ArtifactError };

/**
 * Options passed to `Provider.complete()`. All fields are optional —
 * a provider with no special handling treats the call as the bare
 * `prompt → string` form (the v0.1.x contract).
 */
export interface ProviderCompleteOptions {
  /** Override the model identifier inside the provider. */
  readonly model?: string;
  /**
   * Hard cap on output tokens. Providers that support it (OpenAI,
   * Anthropic, Google) translate this to their `max_tokens` /
   * `max_output_tokens` field so the model is stopped server-side
   * before spending tokens the caller discards.
   *
   * Default: undefined (no cap; provider's own default applies).
   */
  readonly maxTokens?: number;
  /**
   * Per-attempt timeout in milliseconds. Providers should abort the
   * in-flight HTTP request (via `AbortSignal` or equivalent) if it
   * takes longer than this. Default: undefined (no client-side
   * timeout; rely on the server).
   */
  readonly timeoutMs?: number;
}

/**
 * Shared LLM provider contract.
 *
 * Every concrete provider (OpenAI, Gemini, Anthropic, Ollama, ...) implements
 * this. The core SDK never imports a provider implementation directly; it asks
 * for a `Provider` via dependency injection.
 */
export interface Provider {
  /** Stable identifier, e.g. `mock`, `openai`, `ollama`. */
  readonly id: string;
  /** Default model to use if the caller does not override. */
  readonly defaultModel: string;
  /** Send a prompt to the model and return the raw response text. */
  complete(prompt: string, options?: ProviderCompleteOptions): Promise<string>;
}