/**
 * Component registry: stores allowed UI components for artifact generation.
 *
 * The registry decides which JSX tags the validator will accept. It does
 * not interpret or render components — that's the playground app's job.
 *
 * @packageDocumentation
 */

/** A component name. */
export type ComponentName = string;

/** Read/write set of allowed component names. */
export interface Registry {
  isAllowed(name: ComponentName): boolean;
  list(): readonly ComponentName[];
  add(name: ComponentName): void;
}

export type { PropKind, PropSchema, ComponentSchema } from './schema.js';
