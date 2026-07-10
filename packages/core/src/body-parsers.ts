/**
 * Body-parsing helpers for the JSON-bodied kinds.
 *
 * These are thin typed wrappers around `JSON.parse` that return a
 * discriminated result. The validator's JSON shape check (see
 * `validateForKind` in @playgenx/validators) is the source of truth
 * for "is this body well-formed?" — these parsers just turn a
 * validated body into a typed value.
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
 * Parse a poll body returned by {@link generatePoll}. Returns a typed
 * result with the validated shape.
 *
 * Caller must ensure the body has already been validated with
 * {@link validateForKind} from @playgenx/validators. This function
 * trusts the shape and only does JSON.parse + type narrowing.
 */
export function parsePollBody(body: string): ParseResult<Poll> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'expected a JSON object' };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.question !== 'string') {
    return { ok: false, error: 'missing `question` (string)' };
  }
  if (!Array.isArray(r.options)) {
    return { ok: false, error: 'missing `options` (array)' };
  }
  const options: PollOption[] = [];
  for (let i = 0; i < r.options.length; i++) {
    const opt = r.options[i] as Record<string, unknown>;
    if (typeof opt.id !== 'string' || typeof opt.label !== 'string') {
      return { ok: false, error: `option ${i}: id and label must be strings` };
    }
    options.push({ id: opt.id, label: opt.label });
  }
  return {
    ok: true,
    value: {
      question: r.question,
      options,
    },
  };
}

/**
 * Parse a quiz body returned by {@link generateQuiz}.
 */
export function parseQuizBody(body: string): ParseResult<Quiz> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'expected a JSON object' };
  }
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.questions)) {
    return { ok: false, error: 'missing `questions` (array)' };
  }
  const questions: QuizQuestion[] = [];
  for (let i = 0; i < r.questions.length; i++) {
    const q = r.questions[i] as Record<string, unknown>;
    if (typeof q.id !== 'string' || typeof q.prompt !== 'string') {
      return { ok: false, error: `question ${i}: id and prompt must be strings` };
    }
    if (!Array.isArray(q.options)) {
      return { ok: false, error: `question ${i}: options must be an array` };
    }
    const options: PollOption[] = [];
    for (let j = 0; j < q.options.length; j++) {
      const o = q.options[j] as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.label !== 'string') {
        return { ok: false, error: `question ${i} option ${j}: id and label must be strings` };
      }
      options.push({ id: o.id, label: o.label });
    }
    if (typeof q.answer !== 'string') {
      return { ok: false, error: `question ${i}: answer must be a string` };
    }
    questions.push({
      id: q.id,
      prompt: q.prompt,
      options,
      answer: q.answer,
    });
  }
  return { ok: true, value: { questions } };
}

/**
 * Parse a flashcards body returned by {@link generateFlashcards}.
 */
export function parseFlashcardsBody(body: string): ParseResult<{ cards: Flashcard[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'expected a JSON object' };
  }
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.cards)) {
    return { ok: false, error: 'missing `cards` (array)' };
  }
  const cards: Flashcard[] = [];
  for (let i = 0; i < r.cards.length; i++) {
    const c = r.cards[i] as Record<string, unknown>;
    if (
      typeof c.id !== 'string' ||
      typeof c.front !== 'string' ||
      typeof c.back !== 'string'
    ) {
      return { ok: false, error: `card ${i}: id, front, back must be strings` };
    }
    cards.push({ id: c.id, front: c.front, back: c.back });
  }
  return { ok: true, value: { cards } };
}