import { describe, expect, it } from 'vitest';
import { flashcardsPrompt } from './flashcards.js';

describe('flashcardsPrompt', () => {
  it('includes the target concept and lecture context', () => {
    const out = flashcardsPrompt({
      context: 'A lecture on HTTP status codes.',
      concept: 'http-status-codes',
      kind: 'flashcards',
    });
    expect(out).toContain('http-status-codes');
    expect(out).toContain('A lecture on HTTP status codes.');
  });

  it('specifies a cards array with front and back fields', () => {
    const out = flashcardsPrompt({ context: 'x', concept: 'y', kind: 'flashcards' });
    expect(out).toContain('"cards"');
    expect(out).toContain('"front"');
    expect(out).toContain('"back"');
  });

  it('specifies 5 to 20 cards', () => {
    const out = flashcardsPrompt({ context: 'x', concept: 'y', kind: 'flashcards' });
    expect(out).toMatch(/5.*20|5 to 20/);
  });

  it('appends caller-provided override instructions when present', () => {
    const out = flashcardsPrompt({
      context: 'ctx',
      concept: 'c',
      kind: 'flashcards',
      promptOverride: 'Keep every card to 5 words or fewer.',
    });
    expect(out).toContain('Keep every card to 5 words or fewer.');
  });
});