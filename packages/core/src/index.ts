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

export {
  generatePlayground,
  generatePoll,
  generateQuiz,
  generateSimulation,
  generateFlashcards,
  generateLab,
} from './generate.js';
export type { GenerateOptions } from './generate.js';

// Body parsers for the JSON-bodied kinds. Use these to turn the raw
// `Artifact.body` string into a typed value.
export {
  parsePollBody,
  parseQuizBody,
  parseFlashcardsBody,
} from './body-parsers.js';
export type { Poll, PollOption, Quiz, QuizQuestion, Flashcard } from './body-types.js';
export type { ParseResult, ParseOk, ParseErr } from './body-parsers.js';

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
export { validate, validateForKind } from '@playgenx/validators';
export type { ValidationError, ValidateOptions } from '@playgenx/validators';
export { createRegistry, DEFAULT_REGISTRY, BUILT_IN_TAGS } from '@playgenx/registry';
export type { Registry, ComponentName } from '@playgenx/registry';
export { MockProvider, OpenAIProvider, OpenAIError } from '@playgenx/providers';
export type { OpenAIProviderOptions } from '@playgenx/providers';

export {
  playgroundPrompt,
  pollPrompt,
  quizPrompt,
  simulationPrompt,
  flashcardsPrompt,
  labPrompt,
} from '@playgenx/prompts';