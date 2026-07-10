/**
 * Typed body shapes for the JSON-bodied artifact kinds.
 *
 * These types are inferred from the prompt templates in
 * @playgenx/prompts. Use the matching parser in `body-parsers.ts` to
 * convert a raw `Artifact.body` string into a typed value.
 */

export interface PollOption {
  id: string;
  label: string;
}

export interface Poll {
  question: string;
  options: PollOption[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: PollOption[];
  /** The `id` of the correct option in `options`. */
  answer: string;
}

export interface Quiz {
  questions: QuizQuestion[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}