/**
 * OpenTelemetry integration surface for PlayGenX.
 *
 * Consumers register a tracer provider once at startup. When set,
 * every `Provider.complete()` call wraps in a `gen_ai.chat` span
 * and `extractArtifact()` plus `validate()` run as child spans.
 * When no provider is set, the SDK keeps zero overhead and no
 * spans are produced.
 *
 * @packageDocumentation
 */

/**
 * Subset of the OTel API we use. We type against this surface so the
 * package builds even when the dependency is genuinely absent — the
 * import is dynamic. See `tracer.ts` for the load logic.
 */
export interface OTelTracerLike {
  startSpan(
    name: string,
    options?: {
      attributes?: Readonly<Record<string, string | number | boolean>>;
    },
  ): OTelSpanLike;
}

export interface OTelSpanLike {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: 'ok' | 'error'; message?: string }): void;
  end(): void;
  recordException(err: unknown): void;
}

/** Span attribute names follow the OpenTelemetry GenAI semantic conventions. */
export const GEN_AI_SPAN = 'gen_ai.chat';

export function genAiAttribute(
  key:
    | 'gen_ai.system'
    | 'gen_ai.request.model'
    | 'gen_ai.request.max_tokens'
    | 'gen_ai.operation.name'
    | 'gen_ai.usage.input_tokens'
    | 'gen_ai.usage.output_tokens'
    | 'gen_ai.response.finish_reasons',
  value: string | number | boolean,
): readonly [string, string | number | boolean] {
  return [key, value] as const;
}

/** Span names for the SDK's own operations. */
export const PGX_SPAN_EXTRACT = 'pgx.extract';
export const PGX_SPAN_VALIDATE = 'pgx.validate';

/**
 * Token usage on a completed generation. Additive on `Artifact` —
 * emitted when the provider supplied token counts.
 */
export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Per-model pricing, USD per 1K tokens. Maintained in
 * `packages/providers/src/pricing.ts`; this is the shared shape.
 */
export interface PricingRate {
  readonly model: string;
  readonly inputPer1k: number;
  readonly outputPer1k: number;
}

/**
 * Estimate cost in USD from a usage block + a pricing table. Pure
 * function, no side effects, easy to unit test.
 */
export function estimateCost(usage: TokenUsage, rate: PricingRate): number {
  if (!Number.isFinite(usage.inputTokens) || !Number.isFinite(usage.outputTokens)) {
    return 0;
  }
  if (usage.inputTokens < 0 || usage.outputTokens < 0) return 0;
  return (
    (usage.inputTokens / 1000) * rate.inputPer1k + (usage.outputTokens / 1000) * rate.outputPer1k
  );
}
