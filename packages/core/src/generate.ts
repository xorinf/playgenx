import { extractArtifact } from '@playgenx/parser';
import { DEFAULT_REGISTRY, type Registry } from '@playgenx/registry';
import { validate } from '@playgenx/validators';
import type {
  ArtifactRequest,
  ArtifactResult,
  Provider,
} from '@playgenx/types';

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
   * Custom validator. Defaults to {@link validate} from @playgenx/validators.
   * Return `null` on success, or a string with an error message on failure.
   */
  readonly validate?: (body: string) => string | null;
  /**
   * Skip the JSX-tag balance check. Useful for JSON-bodied artifacts
   * (poll, quiz, flashcards) where the body is `{"question":"…"}` and
   * tag balancing is meaningless.
   */
  readonly skipJsxCheck?: boolean;
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
  const prompt = buildPrompt(request);

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

  // 3) Validate. Skip the JSX-tag balance check for JSON-bodied kinds.
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
    const built = validate(parsed.body, registry, { skipJsxCheck: options.skipJsxCheck ?? false });
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
    { ...options, skipJsxCheck: true },
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
    { ...options, skipJsxCheck: true },
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
    { ...options, skipJsxCheck: true },
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