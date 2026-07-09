import type { ArtifactRequest } from '@playgenx/types';

/**
 * Build the prompt used to generate an interactive simulation artifact.
 *
 * A simulation is a TSX/HTML body that models a concept dynamically —
 * e.g. a step-by-step visualization of an algorithm, a graph that
 * evolves over time, or a physics demo.
 *
 * Body shape: a single self-contained TSX or HTML snippet.
 *
 * @param request - The artifact request.
 * @returns The prompt string to send to the provider.
 */
export function simulationPrompt(request: ArtifactRequest): string {
  const lines: string[] = [
    'You are PlayGenX, an assistant that turns lecture content into interactive simulations.',
    '',
    `Target concept: ${request.concept}`,
    '',
    'Lecture context:',
    request.context,
    '',
    'Produce a single self-contained interactive simulation that lets a learner',
    'observe this concept in motion. Prefer small, runnable examples over prose.',
    'Include enough state to make the simulation visibly progress over time',
    '(step counters, evolving values, animations — whatever fits the concept).',
    'Use only components from the default registry: Button, TextField, Slider,',
    'Chart, Container, Code, Heading, Text, Stepper, Card, List, plus standard',
    'HTML elements (div, span, p, button, input, etc.).',
    '',
    'Wrap the simulation in a ```tsx code fence.',
  ];

  if (request.promptOverride) {
    lines.push('', 'Additional instructions:', request.promptOverride);
  }

  return lines.join('\n');
}