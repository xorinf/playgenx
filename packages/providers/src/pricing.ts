/**
 * Pricing table for completed generations.
 *
 * Maintained in a single file so providers and the SDK can read
 * the same numbers. Prices in USD per 1K tokens. Numbers come from
 * each provider's public pricing page; treat them as best-effort
 * snapshots, not contracts. Add a row when the relevant provider
 * notes a price change.
 *
 * @packageDocumentation
 */

import type { TokenUsage } from '@playgenx/types';

/** Per-1K-token pricing for a known model. */
export interface PricingRate {
  readonly model: string;
  readonly inputPer1k: number;
  readonly outputPer1k: number;
}

/** Public rates table. Numbers are USD per 1K tokens. */
export const PRICING_TABLE: readonly PricingRate[] = [
  // OpenAI
  { model: 'gpt-4o-mini', inputPer1k: 0.00015, outputPer1k: 0.0006 },
  { model: 'gpt-4o', inputPer1k: 0.0025, outputPer1k: 0.01 },
  { model: 'gpt-4.1-mini', inputPer1k: 0.0004, outputPer1k: 0.0016 },
  { model: 'gpt-4.1', inputPer1k: 0.002, outputPer1k: 0.008 },
  // Anthropic (illustrative — no Anthropic provider yet, but the
  // pricing rows are still useful when consumers wire one)
  { model: 'claude-haiku-4-5', inputPer1k: 0.0008, outputPer1k: 0.004 },
  { model: 'claude-sonnet-4-5', inputPer1k: 0.003, outputPer1k: 0.015 },
];

/** Find the pricing row that matches `model` exactly. */
export function findPricing(model: string): PricingRate | null {
  return PRICING_TABLE.find((r) => r.model === model) ?? null;
}

/**
 * Compute cost in USD given a usage block + a pricing rate. Returns
 * 0 for negative or non-finite token counts.
 */
export function computeCost(usage: TokenUsage, rate: PricingRate): number {
  if (
    !Number.isFinite(usage.inputTokens) ||
    !Number.isFinite(usage.outputTokens) ||
    usage.inputTokens < 0 ||
    usage.outputTokens < 0
  ) {
    return 0;
  }
  return (
    (usage.inputTokens / 1000) * rate.inputPer1k + (usage.outputTokens / 1000) * rate.outputPer1k
  );
}

/**
 * Convenience: look up pricing by model and compute cost.
 * Returns `undefined` if no row matches — callers should surface
 * `costUsd: undefined` in that case rather than 0.
 */
export function estimateCostFor(model: string, usage: TokenUsage): number | undefined {
  const rate = findPricing(model);
  if (!rate) return undefined;
  return computeCost(usage, rate);
}
