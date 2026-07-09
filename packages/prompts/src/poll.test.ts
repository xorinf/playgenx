import { describe, expect, it } from 'vitest';
import { pollPrompt } from './poll.js';

describe('pollPrompt', () => {
  it('includes the target concept and lecture context', () => {
    const out = pollPrompt({
      context: 'A lecture about closures.',
      concept: 'closures',
      kind: 'poll',
    });
    expect(out).toContain('closures');
    expect(out).toContain('A lecture about closures.');
  });

  it('specifies JSON output format with options', () => {
    const out = pollPrompt({ context: 'x', concept: 'y', kind: 'poll' });
    expect(out).toMatch(/JSON/);
    expect(out).toContain('"question"');
    expect(out).toContain('"options"');
    expect(out).toContain('"id"');
    expect(out).toContain('"label"');
  });

  it('requests 2 to 4 options', () => {
    const out = pollPrompt({ context: 'x', concept: 'y', kind: 'poll' });
    expect(out).toMatch(/2.*4.*options|2 to 4/);
  });

  it('appends caller-provided override instructions when present', () => {
    const out = pollPrompt({
      context: 'ctx',
      concept: 'c',
      kind: 'poll',
      promptOverride: 'Make it a true/false poll.',
    });
    expect(out).toContain('Make it a true/false poll.');
    expect(out).toContain('Additional instructions:');
  });
});