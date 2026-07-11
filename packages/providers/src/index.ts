/**
 * LLM provider implementations.
 *
 * Every provider implements the {@link Provider} contract from
 * `@playgenx/types`. The core SDK consumes this interface and never
 * references concrete providers directly.
 *
 * @packageDocumentation
 */

export type { Provider } from '@playgenx/types';

export { MockProvider } from './mock.js';
export { OpenAIProvider, OpenAIError } from './openai.js';
export type { OpenAIProviderOptions } from './openai.js';
export type { PricingRate } from './pricing.js';
export { PRICING_TABLE, findPricing, computeCost, estimateCostFor } from './pricing.js';
