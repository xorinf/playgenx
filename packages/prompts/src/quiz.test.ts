import { describe, expect, it } from 'vitest';
import { quizPrompt } from './quiz.js';

describe('quizPrompt', () => {
  it('includes the target concept and lecture context', () => {
    const out = quizPrompt({
      context: 'A lecture about Big O notation.',
      concept: 'big-o',
      kind: 'quiz',
    });
    expect(out).toContain('big-o');
    expect(out).toContain('A lecture about Big O notation.');
  });

  it('specifies a questions array with answer field', () => {
    const out = quizPrompt({ context: 'x', concept: 'y', kind: 'quiz' });
    expect(out).toContain('"questions"');
    expect(out).toContain('"prompt"');
    expect(out).toContain('"answer"');
  });

  it('specifies 3 to 8 questions and 2 to 4 options per question', () => {
    const out = quizPrompt({ context: 'x', concept: 'y', kind: 'quiz' });
    expect(out).toMatch(/3.*8.*questions|3 to 8/);
    expect(out).toMatch(/2.*4/);
  });

  it('appends caller-provided override instructions when present', () => {
    const out = quizPrompt({
      context: 'ctx',
      concept: 'c',
      kind: 'quiz',
      promptOverride: 'Make every question a code-completion.',
    });
    expect(out).toContain('Make every question a code-completion.');
  });
});