/**
 * @playgenx/observability
 *
 * OpenTelemetry GenAI instrumentation for the PlayGenX pipeline.
 *
 * @packageDocumentation
 */

export { getTracer, setTracer, NOOP_SPAN, _resetTracerCache } from './tracer.js';

export type { OTelSpanLike, OTelTracerLike, TokenUsage, PricingRate } from './types.js';
export {
  GEN_AI_SPAN,
  PGX_SPAN_EXTRACT,
  PGX_SPAN_VALIDATE,
  genAiAttribute,
  estimateCost,
} from './types.js';
