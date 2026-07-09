import type { ArtifactRequest } from '@playgenx/types';

/**
 * Build the prompt used to generate a deck of flashcards.
 *
 * A flashcard deck has 5–20 cards covering the target concept, each
 * with a short front (prompt) and back (answer).
 *
 * Body shape (JSON):
 * {
 *   "cards": [
 *     { "id": "c1", "front": "What is a closure?", "back": "A function that captures variables from its enclosing scope." },
 *     ...
 *   ]
 * }
 *
 * @param request - The artifact request.
 * @returns The prompt string to send to the provider.
 */
export function flashcardsPrompt(request: ArtifactRequest): string {
  const lines: string[] = [
    'You are PlayGenX, an assistant that turns lecture content into flashcard decks.',
    '',
    `Target concept: ${request.concept}`,
    '',
    'Lecture context:',
    request.context,
    '',
    'Produce a JSON object describing a flashcard deck with 5 to 20 cards about',
    'this concept. Each card has a short front (the prompt the learner sees)',
    'and a back (the answer or explanation). Keep each side to one sentence.',
    '',
    'Output format: a single JSON object with this exact shape:',
    '{',
    '  "cards": [',
    '    { "id": "<c1/c2/c3>", "front": "<prompt>", "back": "<answer>" },',
    '    ...',
    '  ]',
    '}',
    '',
    'Wrap the JSON in a ```json code fence. Do not include prose outside the fence.',
  ];

  if (request.promptOverride) {
    lines.push('', 'Additional instructions:', request.promptOverride);
  }

  return lines.join('\n');
}