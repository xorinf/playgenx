/**
 * Public PlayGenX SDK entry point.
 *
 * Exposes high-level functions like {@link generatePlayground} that wire
 * providers, prompts, and parsers into a single call. All side effects
 * (LLM calls, validation) flow through injected dependencies.
 *
 * @packageDocumentation
 */

export { generatePlayground } from './generate.js';
export type {
  ArtifactRequest,
  Artifact,
  ArtifactError,
  ArtifactResult,
  ArtifactKind,
  Provider,
} from '@playgenx/types';