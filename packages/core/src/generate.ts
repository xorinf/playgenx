import type { ArtifactRequest, ArtifactResult, Provider } from '@playgenx/types';
import { playgroundPrompt } from '@playgenx/prompts';

export interface GeneratePlaygroundOptions {
  /** Provider to call. Required — no default to keep behavior explicit. */
  readonly provider: Provider;
  /** Override the model the provider should use. */
  readonly model?: string;
}

/**
 * Generate an interactive playground artifact for a given concept.
 *
 * Pipeline:
 *   1. Build the prompt via {@link playgroundPrompt}.
 *   2. Call the injected provider.
 *   3. Return a discriminated {@link ArtifactResult}.
 *
 * Validation and parsing are intentionally not wired in yet — those land in
 * subsequent releases as `packages/validators` and `packages/parser` mature.
 *
 * @param request - Lecture context and target concept.
 * @param options - Provider injection and optional model override.
 */
export async function generatePlayground(
  request: ArtifactRequest,
  options: GeneratePlaygroundOptions,
): Promise<ArtifactResult> {
  const prompt = playgroundPrompt(request);

  try {
    const body = await options.provider.complete(prompt, { model: options.model });
    return {
      ok: true,
      artifact: {
        kind: request.kind,
        body,
        providerId: options.provider.id,
        model: options.model ?? options.provider.defaultModel,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: request.kind,
        providerId: options.provider.id,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}