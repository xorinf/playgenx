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
//
// v0.4: these now resolve to the Zod-backed parsers in
// `body-schemas.ts`, which produce structured issues when Zod is
// installed and fall back to the trusted-shape cast otherwise. The
// return shape (`{ ok, value } | { ok, error }`) is unchanged from
// v0.3.x — existing callers keep working without changes. The
// v0.3 implementations still live in `body-parsers.ts` for callers
// that need them, but the public name points here.
export { parsePollBody, parseQuizBody, parseFlashcardsBody } from './body-schemas.js';
export type { Poll, PollOption, Quiz, QuizQuestion, Flashcard } from './body-types.js';
export type { ParseResult, ParseOk, ParseErr } from './body-schemas.js';

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
export { PRICING_TABLE, findPricing, computeCost, estimateCostFor } from '@playgenx/providers';
export type { PricingRate } from '@playgenx/providers';

// Observability (v0.4). Optional OpenTelemetry instrumentation.
export { getTracer, setTracer, NOOP_SPAN } from '@playgenx/observability';
export type { OTelSpanLike, OTelTracerLike } from '@playgenx/observability';
export type { TokenUsage } from '@playgenx/types';

// v0.4: Zod-backed body schemas (optional). When Zod is installed,
// the parsers surface structured issues; otherwise they fall back to
// the trusted-shape cast. The canonical `parsePollBody` /
// `parseQuizBody` / `parseFlashcardsBody` re-exports above already
// point at these, so most callers don't need anything new here —
// but the underlying schemas are exported for callers who want to
// run them on their own data.
export { pollSchemaBody, quizSchemaBody, flashcardsSchemaBody } from './body-schemas.js';
export type { Infer } from './body-schemas.js';

export {
  playgroundPrompt,
  pollPrompt,
  quizPrompt,
  simulationPrompt,
  flashcardsPrompt,
  labPrompt,
} from '@playgenx/prompts';

// v0.5: optional React-side rendering. The renderer + components
// packages are peer deps (not bundled) so backend-only consumers
// don't pull React into their bundle. Importing these from the
// umbrella is a convenience for full-stack consumers; backend
// consumers can stay on `playgenx` alone. When you import these
// from `playgenx`, React must be in the host's dependency tree
// (it's declared as a peer dep on the umbrella).
//
// The renderer does NOT use `new Function(string)` to evaluate
// expressions — TSX expression positions become inert
// `RenderExpression` placeholders that string-stringify at render
// time. This keeps viBe's CSP-compliant default (no `'unsafe-eval'`)
// working: their iframe tree can use @playgenx/renderer without
// needing a CSP allowance change.
//
// Inlined re-export: we import from the package entry points and
// re-export, so consumers can install only the umbrella plus React
// to render their artifacts.
export { renderBody, renderNodes, renderNode, RenderExpression, propToSource } from '@playgenx/renderer';
export type {
  RendererNode,
  RendererElement,
  RendererText,
  RendererFallthrough,
  ParsedProp,
  PropKind,
  ComponentMap,
  RenderInputProps,
  RenderBodyOptions,
} from '@playgenx/renderer';
export {
  Button,
  TextField,
  Slider,
  Chart,
  Container,
  Code,
  Heading,
  Text,
  Stepper,
  Card,
  List,
  componentMap,
  type ButtonProps,
  type TextFieldProps,
  type SliderProps,
  type ChartProps,
  type ChartKind,
  type ContainerProps,
  type CodeProps,
  type HeadingProps,
  type TextProps,
  type StepperProps,
  type Step,
  type CardProps,
  type ListProps,
  type ComponentMapKey,
} from '@playgenx/components';
export {
  StorageProvider,
  StorageContext,
  useStorage,
  useStorageContext,
  useSaveArtifact,
  useListedArtifacts,
  useStoredArtifact,
  useDeleteArtifact,
  type StorageProviderProps,
  type HookResult,
} from '@playgenx/storage-react';
