/**
 * Zod-based body parsers for the JSON-bodied kinds.
 *
 * These supplement (do not replace) the regex validator in
 * `@playgenx/validators`. The validator's contract is "this
 * body is well-formed JSON matching the rough shape" — the
 * Zod schemas here are stricter and produce typed values with
 * structured issues.
 *
 * The parsers are Zod-optional: callers without Zod installed
 * fall back to the trusted-shape cast in `body-parsers.ts`.
 * This is the same "optional peer dep" pattern as the S3
 * adapter and the OTel instrumentation.
 *
 * @packageDocumentation
 */

/**
 * Type stub for the optional Zod dependency. The runtime code
 * uses `tryLoadZod()` (dynamic require); TypeScript needs a
 * `z`-typed shape for the schemas' parse callbacks. We use a
 * structural type so consumers without Zod installed still
 * compile.
 *
 * @internal
 */

export type z<T = unknown> = {
  string(): z;
  number(): z;
  min(n: number): z;
  max(n: number): z;
  array(schema: z<T>): z<T[]>;
  object<S extends Record<string, z<unknown>>>(shape: S): z<{ [K in keyof S]: unknown }>;
  parse(input: unknown): T;
  refine(fn: (val: T) => boolean, opts?: { message?: string }): z;
};

import type { Flashcard, Poll, Quiz } from './body-types.js';

export type { Flashcard, Poll, Quiz } from './body-types.js';

export type ParseOk<T> = { ok: true; value: T };
export type ParseErr = { ok: false; error: string };
export type ParseResult<T> = ParseOk<T> | ParseErr;

/**
 * Body schema export type for callers that want `z.infer`-style
 * extraction.
 *
 * The wrapper object's `parse` method is concretely typed as
 * `(input: unknown) => Poll` (or `Quiz`, `Flashcard[]`), so
 * `Infer<typeof pollSchemaBody>` resolves to `Poll`. If you want a
 * `z.infer`-style narrow type from a real Zod schema, install Zod and
 * do `z.infer<typeof SomeSchema>` directly — `Infer<T>` here is just
 * the same `T extends { parse: ... }` utility shape with the
 * concrete return type made explicit.
 */
export type Infer<T> = T extends { parse: (input: unknown) => infer U } ? U : never;

function tryLoadZod(): typeof import('zod') | null {
  // Vitest's no-require-imports rule for ESM, but the specifier
  // resolution for `zod` works via the static import in `types.ts`
  // — which the bundler keeps — so we just go through that.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('zod') as typeof import('zod');
  } catch {
    return null;
  }
}

/**
 * Body schema for `poll` kind. Mirrors the regex validator's
 * contract with one extra strictness: options must be an array
 * (the regex already requires this; the schema makes the type
 * explicit for downstream callers).
 */
export const pollSchemaBody: { parse: (input: unknown) => Poll } = {
  parse(raw: unknown): Poll {
    const z = tryLoadZod();
    if (z) {
      const Schema = z.object({
        question: z.string().min(1),
        options: z
          .array(
            z.object({
              id: z.string().min(1),
              label: z.string(),
            }),
          )
          .min(2)
          .max(4),
      });
      return Schema.parse(raw) as Poll;
    }
    // Fallback cast when Zod is not installed.
    const r = raw as { question: string; options: Array<{ id: string; label: string }> };
    return { question: r.question, options: r.options.map((o) => ({ id: o.id, label: o.label })) };
  },
};

/**
 * Body schema for `quiz` kind. Stricter than the regex: enforces
 * that each `answer` exists in the question's options (regex only
 * checks that it's a non-empty string).
 */
export const quizSchemaBody: { parse: (input: unknown) => Quiz } = {
  parse(raw: unknown): Quiz {
    const z = tryLoadZod();
    if (z) {
      const Schema = z.object({
        questions: z
          .array(
            z
              .object({
                id: z.string().min(1),
                prompt: z.string().min(1),
                options: z
                  .array(
                    z.object({
                      id: z.string().min(1),
                      label: z.string(),
                    }),
                  )
                  .min(2)
                  .max(4),
                answer: z.string().min(1),
              })
              .refine((q) => q.options.some((o) => o.id === q.answer), {
                message: 'answer must reference an option id',
              }),
          )
          .min(3)
          .max(8),
      });
      return Schema.parse(raw) as Quiz;
    }
    const r = raw as {
      questions: Array<{
        id: string;
        prompt: string;
        options: Array<{ id: string; label: string }>;
        answer: string;
      }>;
    };
    return { questions: r.questions };
  },
};

/**
 * Body schema for `flashcards` kind.
 */
export const flashcardsSchemaBody: { parse: (input: unknown) => { cards: Flashcard[] } } = {
  parse(raw: unknown): { cards: Flashcard[] } {
    const z = tryLoadZod();
    if (z) {
      const Schema = z.object({
        cards: z
          .array(
            z.object({
              id: z.string().min(1),
              front: z.string().min(1),
              back: z.string().min(1),
            }),
          )
          .min(5)
          .max(20),
      });
      return Schema.parse(raw) as { cards: Flashcard[] };
    }
    const r = raw as { cards: Array<{ id: string; front: string; back: string }> };
    return { cards: r.cards };
  },
};

/**
 * Parse a poll body, returning a structured result. When Zod is
 * installed, surfaces structured issues; otherwise falls back to
 * the trusted-shape cast. The validator must already have run
 * (see module-level comment).
 */
export function parsePollBody(body: string): ParseResult<Poll> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    return { ok: true, value: pollSchemaBody.parse(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function parseQuizBody(body: string): ParseResult<Quiz> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    return { ok: true, value: quizSchemaBody.parse(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function parseFlashcardsBody(body: string): ParseResult<{ cards: Flashcard[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  try {
    return { ok: true, value: flashcardsSchemaBody.parse(raw) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
