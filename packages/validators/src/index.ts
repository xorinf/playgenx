/**
 * Validation: substring checks, tag balance, component allowlist.
 *
 * v0.1.0 is intentionally lightweight — it uses regex/substring checks
 * rather than a real parser. For untrusted input, treat the validator as
 * a *first* line of defense, not a security boundary. Render artifacts in
 * a sandboxed context.
 *
 * @packageDocumentation
 */

export { validate } from './check.js';
export type { ValidationError, ValidateOptions } from './types.js';