/**
 * LLM response parsing utilities for PlayGenX.
 *
 * The parser is a pure function library — no IO, no env, no network.
 * It takes raw LLM text and returns a structured {@link ExtractResult}.
 *
 * @packageDocumentation
 */

export {
  extractArtifact,
  stripThinkingTags,
  type ExtractKind,
  type ExtractSource,
  type ParseError,
  type ExtractResult,
} from './extract.js';
