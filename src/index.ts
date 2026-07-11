/**
 * PlayGenX public API.
 *
 * This module exports the entry points for the PlayGenX SDK.
 * Implementation is intentionally minimal at the 0.1.0 bootstrap stage;
 * subsequent releases will fill in provider integrations, prompt templates,
 * validators, and the parser pipeline.
 *
 * @packageDocumentation
 */

export const VERSION = '0.1.0' as const;

/** Placeholder export so `tsdown` has a real entry to bundle. */
export function version(): string {
  return VERSION;
}
