import type { ArtifactRequest } from '@playgenx/types';

/**
 * Build the prompt used to generate a poll artifact.
 *
 * A poll is a single multiple-choice question with 2–4 options. The
 * LLM is asked to produce a JSON object matching the schema described
 * below. The caller renders the result as a poll UI.
 *
 * Body shape (JSON):
 * {
 *   "question": "What is the time complexity of binary search?",
 *   "options": [
 *     { "id": "a", "label": "O(n)" },
 *     { "id": "b", "label": "O(log n)" },
 *     { "id": "c", "label": "O(1)" },
 *     { "id": "d", "label": "O(n log n)" }
 *   ]
 * }
 *
 * @param request - The artifact request.
 * @returns The prompt string to send to the provider.
 */
export function pollPrompt(request: ArtifactRequest): string {
  const lines: string[] = [
    'You are PlayGenX, an assistant that turns lecture content into interactive polls.',
    '',
    `Target concept: ${request.concept}`,
    '',
    'Lecture context:',
    request.context,
    '',
    'Produce a JSON object describing a single multiple-choice poll question about',
    'this concept. The poll must have between 2 and 4 options.',
    '',
    'Output format: a single JSON object with this exact shape:',
    '{',
    '  "question": "<the question text>",',
    '  "options": [',
    '    { "id": "<short id, e.g. a/b/c/d>", "label": "<option label>" },',
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