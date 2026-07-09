import type { ArtifactRequest } from '@playgenx/types';

/**
 * Build the prompt used to generate an interactive playground artifact.
 *
 * The template is intentionally simple: the LLM is asked to produce a single
 * self-contained TSX/HTML snippet that exercises the target concept. The
 * caller can append instructions via {@link ArtifactRequest.promptOverride}.
 *
 * @param request - The artifact request.
 * @returns The prompt string to send to the provider.
 */
export function playgroundPrompt(request: ArtifactRequest): string {
  const lines: string[] = [
    'You are PlayGenX, an assistant that turns lecture content into interactive',
    'educational playgrounds.',
    '',
    `Target concept: ${request.concept}`,
    '',
    'Lecture context:',
    request.context,
    '',
    'Produce a single self-contained interactive component that lets a learner',
    'explore this concept hands-on. Prefer small, runnable examples over prose.',
  ];

  if (request.promptOverride) {
    lines.push('', 'Additional instructions:', request.promptOverride);
  }

  return lines.join('\n');
}