/**
 * Public PlayGenX SDK entry point.
 *
 * Exposes high-level functions like {@link generatePlayground} that wire
 * providers, prompts, parser, and validators into a single call. All side
 * effects (LLM calls) flow through injected dependencies; parsing and
 * validation are pure.
 *
 * @packageDocumentation
 */

export { generatePlayground } from './generate.js';
export type { GeneratePlaygroundOptions } from './generate.js';

export type {
  ArtifactRequest,
  Artifact,
  ArtifactError,
  ArtifactErrorStage,
  ArtifactResult,
  ArtifactKind,
  Provider,
} from '@playgenx/types';

// Re-export the building blocks so advanced users can use them directly
// without reaching into the workspace packages.
export { extractArtifact } from '@playgenx/parser';
export type { ExtractKind, ParseError, ExtractResult } from '@playgenx/parser';
export { validate } from '@playgenx/validators';
export type { ValidationError } from '@playgenx/validators';
export { createRegistry, DEFAULT_REGISTRY, BUILT_IN_TAGS } from '@playgenx/registry';
export type { Registry, ComponentName } from '@playgenx/registry';
export { MockProvider, OpenAIProvider, OpenAIError } from '@playgenx/providers';
export type { OpenAIProviderOptions } from '@playgenx/providers';
