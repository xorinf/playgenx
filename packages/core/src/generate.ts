import { extractArtifact } from '@playgenx/parser';
import { DEFAULT_REGISTRY, type Registry } from '@playgenx/registry';
import { validate } from '@playgenx/validators';
import type {
  ArtifactError,
  ArtifactKind,
  ArtifactRequest,
  ArtifactResult,
  Provider,
} from '@playgenx/types';

export interface GeneratePlaygroundOptions {
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
}

function providerError(
  kind: ArtifactKind,
  providerId: string,
  message: string,
): ArtifactError {
  return { kind, providerId, stage: 'provider', message };
}

/**
 * Generate an interactive playground artifact for a given concept.
 *
 * Pipeline:
 *   1. Build the prompt via `playgroundPrompt`.
 *   2. Call the injected provider.
 *   3. Parse the raw response into a kinded body.
 *   4. Validate the body against the registry.
 *   5. Return a discriminated {@link ArtifactResult}.
 *
 * @param request - Lecture context and target concept.
 * @param options - Provider, model, and optional registry/validator overrides.
 */
export async function generatePlayground(
  request: ArtifactRequest,
  options: GeneratePlaygroundOptions,
): Promise<ArtifactResult> {
  // Lazy import to avoid loading the prompt template unless we actually need it.
  const { playgroundPrompt } = await import('@playgenx/prompts');
  const prompt = playgroundPrompt(request);

  // 1) Provider call.
  let raw: string;
  try {
    raw = await options.provider.complete(prompt, { model: options.model });
  } catch (err) {
    return {
      ok: false,
      error: providerError(
        request.kind,
        options.provider.id,
        err instanceof Error ? err.message : String(err),
      ),
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

  // 3) Validate.
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const doValidate = options.validate ?? ((b: string) => validate(b, registry)?.message ?? null);
  const validationError = doValidate(parsed.body);
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
