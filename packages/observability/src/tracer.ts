/**
 * Lazy OTel loader + tracer holder.
 *
 * The OTel API is loaded via `createRequire` against
 * `@opentelemetry/api`. If the package is not installed, all of
 * these functions degrade gracefully: callers see `null`,
 * `getTracer()` returns a no-op tracer, and `setTracerProvider`
 * stores `null` so subsequent calls don't redo the lookup.
 *
 * @packageDocumentation
 */

import { createRequire } from 'node:module';
import type { OTelSpanLike, OTelTracerLike } from './types.js';

/** OTel API surface we use — narrowed to a minimal subset. */
interface OtelLike {
  trace: {
    getTracer(name: string, version?: string): OTelTracerLike;
  };
}

let cachedOtel: OtelLike | null = null;
let cachedLoaderFailed = false;

const sdkRequire = createRequire(import.meta.url);

function loadOtel(): OtelLike | null {
  if (cachedLoaderFailed) return null;
  if (cachedOtel) return cachedOtel;
  try {
    // CJS loading, mirrors the S3 adapter pattern. Lazy so consumers
    // who never call setTracerProvider never pay the import cost.
    const mod = sdkRequire('@opentelemetry/api') as unknown as OtelLike;
    cachedOtel = mod;
    return mod;
  } catch {
    cachedLoaderFailed = true;
    return null;
  }
}

/** Reset the cache; for tests. */
export function _resetTracerCache(): void {
  cachedOtel = null;
  cachedLoaderFailed = false;
  tracerInstance = null;
}

let tracerInstance: OTelTracerLike | null | undefined;

/** Returns a tracer or null. Idempotent. */
export function getTracer(): OTelTracerLike | null {
  if (tracerInstance !== undefined) return tracerInstance;
  const otel = loadOtel();
  if (!otel) {
    tracerInstance = null;
    return null;
  }
  tracerInstance = otel.trace.getTracer('@playgenx/core', '0.4.0');
  return tracerInstance;
}

/**
 * Set the global tracer provider. Accepts either an instance
 * matching {@link OTelTracerLike} or `null` to disable. Subsequent
 * calls replace the configured tracer.
 */
export function setTracer(tracer: OTelTracerLike | null): void {
  tracerInstance = tracer;
}

/**
 * No-op tracer returned when no provider is configured. Methods
 * do nothing so call-sites can stay unbranched.
 */
export const NOOP_SPAN: OTelSpanLike = {
  setAttribute: () => {},
  setStatus: () => {},
  end: () => {},
  recordException: () => {},
};
