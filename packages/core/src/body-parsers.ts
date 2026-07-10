/**
 * Body-parsing helpers for the JSON-bodied kinds.
 *
 * These are thin typed wrappers around `JSON.parse` that return a
 * discriminated result. The validator's JSON shape check (see
 * `validateForKind` in @playgenx/validators) is the SOURCE OF TRUTH
 * for "is this body well-formed?" — these parsers trust that the
 * body has already been validated.
 *
 * If you call these with a body that did NOT pass `validateForKind`
 * for the matching kind, behaviour is undefined: the parser may throw
 * (e.g. `TypeError: cannot read 'foo' of undefined`), or return
 * garbage. The runtime path inside `generateX` ALWAYS validates first,
 * so this only matters for direct callers.
 *
 * If you need to validate and parse in one step, call
 * `validateForKind` yourself before calling these.
 *
 * @packageDocumentation
 */

import type {
  Flashcard,
  Poll,
  PollOption,
  Quiz,
  QuizQuestion,
} from './body-types.js';

export type { Flashcard, Poll, PollOption, Quiz, QuizQuestion } from './body-types.js';

export type ParseOk<T> = { ok: true; value: T };
export type ParseErr = { ok: false; error: string };
export type ParseResult<T> = ParseOk<T> | ParseErr;

/**
 * Parse a poll body that has already been validated via
 * {@link validateForKind} for the `poll` kind. Returns a typed value.
 *
 * Throws `SyntaxError` if the body is not valid JSON (the validator
 * catches this earlier in the `generatePoll` pipeline, so it should
 * not happen in normal use). The output is trusted as conforming to
 * the `Poll` shape.
 */
export function parsePollBody(body: string): ParseResult<Poll> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  // The validator has already enforced: top-level object, non-empty
  // `question` string, options array of 2-4 objects each with
  // non-empty string id and string label. Cast through the trusted
  // shape.
  const r = raw as { question: string; options: Array<{ id: string; label: string }> };
  const options: PollOption[] = r.options.map((o) => ({ id: o.id, label: o.label }));
  return {
    ok: true,
    value: { question: r.question, options },
  };
}

/**
 * Parse a quiz body that has already been validated via
 * {@link validateForKind} for the `quiz` kind. Returns a typed value.
 *
 * Throws `SyntaxError` if the body is not valid JSON. The output is
 * trusted as conforming to the `Quiz` shape.
 */
export function parseQuizBody(body: string): ParseResult<Quiz> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  // The validator has already enforced: questions array of 3-8
  // objects, each with id/prompt/options/answer that conform.
  const r = raw as {
    questions: Array<{
      id: string;
      prompt: string;
      options: Array<{ id: string; label: string }>;
      answer: string;
    }>;
  };
  const questions: QuizQuestion[] = r.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
    answer: q.answer,
  }));
  return { ok: true, value: { questions } };
}

/**
 * Parse a flashcards body that has already been validated via
 * {@link validateForKind} for the `flashcards` kind. Returns a typed
 * value.
 *
 * Throws `SyntaxError` if the body is not valid JSON. The output is
 * trusted as conforming to the flashcards shape.
 */
export function parseFlashcardsBody(body: string): ParseResult<{ cards: Flashcard[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  // The validator has already enforced: cards array of 5-20 objects
  // each with non-empty id and non-empty front/back strings.
  const r = raw as { cards: Array<{ id: string; front: string; back: string }> };
  const cards: Flashcard[] = r.cards.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
  }));
  return { ok: true, value: { cards } };
}