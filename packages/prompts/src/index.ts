/**
 * Prompt templates for educational artifact generation.
 *
 * Each prompt template is a pure function: given an {@link ArtifactRequest},
 * return the prompt string to send to the LLM. No provider logic lives here.
 *
 * @packageDocumentation
 */

export { playgroundPrompt } from './playground.js';
export { pollPrompt } from './poll.js';
export { quizPrompt } from './quiz.js';
export { simulationPrompt } from './simulation.js';
export { flashcardsPrompt } from './flashcards.js';
export { labPrompt } from './lab.js';
