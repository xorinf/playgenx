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
}

/** Pipeline stage that produced an error. */
export type ArtifactErrorStage = 'prompt' | 'provider' | 'parse' | 'validate';

/** Failure result from any pipeline stage. */
export interface ArtifactError {
  readonly kind: ArtifactKind;
  readonly providerId?: string;
  /** Which pipeline stage produced the error. */
  readonly stage: ArtifactErrorStage;
  readonly message: string;
  /** Optional line number inside the artifact body, if applicable. */
  readonly line?: number;
}

/** Discriminated union returned by `generateX` functions. */
export type ArtifactResult = { ok: true; artifact: Artifact } | { ok: false; error: ArtifactError };

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
  complete(prompt: string, options?: { model?: string }): Promise<string>;
}