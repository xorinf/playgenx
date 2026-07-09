import type { ArtifactRequest } from '@playgenx/types';

/**
 * Build the prompt used to generate a multi-question quiz artifact.
 *
 * A quiz has 3–8 questions covering the target concept, each with 2–4
 * options and a single correct answer.
 *
 * Body shape (JSON):
 * {
 *   "questions": [
 *     {
 *       "id": "q1",
 *       "prompt": "What is the time complexity of binary search?",
 *       "options": [
 *         { "id": "a", "label": "O(n)" },
 *         { "id": "b", "label": "O(log n)" }
 *       ],
 *       "answer": "b"
 *     },
 *     ...
 *   ]
 * }
 *
 * @param request - The artifact request.
 * @returns The prompt string to send to the provider.
 */
export function quizPrompt(request: ArtifactRequest): string {
  const lines: string[] = [
    'You are PlayGenX, an assistant that turns lecture content into multi-question quizzes.',
    '',
    `Target concept: ${request.concept}`,
    '',
    'Lecture context:',
    request.context,
    '',
    'Produce a JSON object describing a quiz with 3 to 8 multiple-choice questions',
    'about this concept. Each question has 2 to 4 options and exactly one correct',
    'answer (the `id` of the correct option).',
    '',
    'Output format: a single JSON object with this exact shape:',
    '{',
    '  "questions": [',
    '    {',
    '      "id": "<short id, e.g. q1/q2/q3>",',
    '      "prompt": "<the question text>",',
    '      "options": [',
    '        { "id": "<a/b/c/d>", "label": "<option label>" },',
    '        ...',
    '      ],',
    '      "answer": "<id of the correct option>"',
    '    },',
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