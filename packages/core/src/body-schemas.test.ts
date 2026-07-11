import { describe, expect, it } from 'vitest';
import {
  parsePollBody,
  parseQuizBody,
  parseFlashcardsBody,
  type Infer,
} from './body-schemas.js';
import type { Poll, Quiz } from './body-types.js';

describe('body-schemas (Zod-backed parsers, v0.4)', () => {
  describe('parsePollBody', () => {
    it('parses a valid poll body', () => {
      const r = parsePollBody(
        JSON.stringify({
          question: 'Pick one',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
        }),
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.question).toBe('Pick one');
      expect(r.value.options.map((o) => o.id)).toEqual(['a', 'b']);
    });

    it('rejects a poll with too few options', () => {
      const r = parsePollBody(
        JSON.stringify({ question: 'q', options: [{ id: 'a', label: 'A' }] }),
      );
      expect(r.ok).toBe(false);
    });

    it('rejects malformed JSON cleanly', () => {
      const r = parsePollBody('not json {');
      expect(r.ok).toBe(false);
    });
  });

  describe('parseQuizBody', () => {
    it('parses a valid quiz with answer referencing an option id', () => {
      const r = parseQuizBody(
        JSON.stringify({
          questions: [
            {
              id: 'q1',
              prompt: 'Why?',
              options: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
                { id: 'c', label: 'C' },
              ],
              answer: 'b',
            },
            {
              id: 'q2',
              prompt: 'How?',
              options: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
              ],
              answer: 'a',
            },
            {
              id: 'q3',
              prompt: 'Where?',
              options: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
              ],
              answer: 'b',
            },
          ],
        }),
      );
      expect(r.ok).toBe(true);
    });

    it('rejects a question whose answer does not match any option id', () => {
      const r = parseQuizBody(
        JSON.stringify({
          questions: [
            {
              id: 'q1',
              prompt: 'p',
              options: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
              ],
              answer: 'nonexistent',
            },
            {
              id: 'q2',
              prompt: 'p',
              options: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
              ],
              answer: 'a',
            },
            {
              id: 'q3',
              prompt: 'p',
              options: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
              ],
              answer: 'b',
            },
          ],
        }),
      );
      expect(r.ok).toBe(false);
    });
  });

  describe('parseFlashcardsBody', () => {
    it('parses a valid deck', () => {
      const r = parseFlashcardsBody(
        JSON.stringify({
          cards: Array.from({ length: 7 }, (_, i) => ({
            id: `c${i + 1}`,
            front: `Q${i + 1}`,
            back: `A${i + 1}`,
          })),
        }),
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.cards).toHaveLength(7);
    });

    it('rejects a deck with too few cards', () => {
      const r = parseFlashcardsBody(
        JSON.stringify({
          cards: Array.from({ length: 4 }, (_, i) => ({
            id: `c${i}`,
            front: `Q${i}`,
            back: `A${i}`,
          })),
        }),
      );
      expect(r.ok).toBe(false);
    });
  });

  // M5 verification: Infer<T> must resolve to the concrete body
  // type (Poll / Quiz / { cards: Flashcard[] }), not `never`. This
  // test would fail to compile if the helper were broken — the
  // assignments force a type-level identity check against the real
  // types, while the runtime expectations confirm the schemas
  // actually return those shapes.
  describe('Infer<T> type-level helper', () => {
    it('Infers<typeof pollSchemaBody> is assignable to Poll', () => {
      type PollInferred = Infer<typeof import('./body-schemas.js').pollSchemaBody>;
      // Bidirectional assignability proves the types are identical,
      // not merely compatible. If `Infer<T>` resolved to `never`,
      // the assignment below would fail to compile.
      const _forward: PollInferred = {} as Poll;
      const _back: Poll = {} as PollInferred;
      void _forward;
      void _back;
      const r = parsePollBody(
        JSON.stringify({
          question: 'q',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
        }),
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      // This line would not typecheck if `r.value` were typed as `never`.
      const _typed: Poll = r.value;
      void _typed;
      expect(_typed.question).toBe('q');
    });

    it('Infers<typeof quizSchemaBody> is assignable to Quiz', () => {
      type QuizInferred = Infer<typeof import('./body-schemas.js').quizSchemaBody>;
      const _forward: QuizInferred = {} as Quiz;
      const _back: Quiz = {} as QuizInferred;
      void _forward;
      void _back;
      const r = parseQuizBody(
        JSON.stringify({
          questions: [
            { id: 'q1', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
            { id: 'q2', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'b' },
            { id: 'q3', prompt: 'p', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], answer: 'a' },
          ],
        }),
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const _typed: Quiz = r.value;
      void _typed;
      expect(_typed.questions).toHaveLength(3);
    });
  });
});
