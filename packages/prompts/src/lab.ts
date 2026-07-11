import type { ArtifactRequest } from '@playgenx/types';

/**
 * Build the prompt used to generate a guided lab artifact.
 *
 * A lab is a multi-step exploration: the learner is given a goal,
 * walks through guided steps, gets hints on demand, and finishes with
 * a self-check.
 *
 * Body shape: a single self-contained TSX/HTML snippet that renders
 * the lab UI (steps panel, hint button, check button).
 *
 * @param request - The artifact request.
 * @returns The prompt string to send to the provider.
 */
export function labPrompt(request: ArtifactRequest): string {
  const lines: string[] = [
    'You are PlayGenX, an assistant that turns lecture content into guided labs.',
    '',
    `Target concept: ${request.concept}`,
    '',
    'Lecture context:',
    request.context,
    '',
    'Produce a single self-contained interactive lab that walks a learner through',
    'this concept in 3 to 6 steps. Each step should have:',
    '  - A short prompt describing what to do or observe',
    '  - A "Show hint" button that reveals a hint (collapsible)',
    '  - A "Check answer" button that gives feedback',
    '',
    'At the end of the lab, show a summary of what was learned.',
    '',
    'Use only components from the default registry: Button, TextField, Slider,',
    'Chart, Container, Code, Heading, Text, Stepper, Card, List, plus standard',
    'HTML elements (div, span, p, button, input, etc.).',
    '',
    'Wrap the lab in a ```tsx code fence.',
  ];

  if (request.promptOverride) {
    lines.push('', 'Additional instructions:', request.promptOverride);
  }

  return lines.join('\n');
}
