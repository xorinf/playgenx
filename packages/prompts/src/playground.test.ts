import { describe, it, expect } from 'vitest';
import { playgroundPrompt } from './playground.js';

describe('playgroundPrompt', () => {
  it('includes the target concept and lecture context', () => {
    const out = playgroundPrompt({
      context: 'A lecture about closures.',
      concept: 'closures',
      kind: 'playground',
    });
    expect(out).toContain('closures');
    expect(out).toContain('A lecture about closures.');
  });

  it('appends caller-provided override instructions when present', () => {
    const out = playgroundPrompt({
      context: 'ctx',
      concept: 'recursion',
      kind: 'playground',
      promptOverride: 'Use Python instead of TSX.',
    });
    expect(out).toContain('Use Python instead of TSX.');
    expect(out).toContain('Additional instructions:');
  });
});