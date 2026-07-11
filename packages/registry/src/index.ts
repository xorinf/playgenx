/**
 * Component registry: allowed UI components for artifact generation.
 *
 * @packageDocumentation
 */

export type { Registry, ComponentName, PropKind, PropSchema, ComponentSchema } from './types.js';
export { createRegistry } from './create.js';
export { DEFAULT_REGISTRY, DEFAULT_COMPONENT_SCHEMAS, BUILT_IN_TAGS, findSchema } from './default.js';
