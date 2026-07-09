import { describe, expect, it } from 'vitest';
import { labPrompt } from './lab.js';

describe('labPrompt', () => {
  it('includes the target concept and lecture context', () => {
    const out = labPrompt({
      context: 'A lecture on building REST APIs.',
      concept: 'rest-apis',
      kind: 'lab',
    });
    expect(out).toContain('rest-apis');
    expect(out).toContain('A lecture on building REST APIs.');
  });

  it('specifies 3 to 6 steps with hint and check buttons', () => {
    const out = labPrompt({ context: 'x', concept: 'y', kind: 'lab' });
    expect(out).toMatch(/3.*6/);
    expect(out).toMatch(/hint/i);
    expect(out).toMatch(/check/i);
  });

  it('appends caller-provided override instructions when present', () => {
    const out = labPrompt({
      context: 'ctx',
      concept: 'c',
      kind: 'lab',
      promptOverride: 'End the lab with a scoring rubric.',
    });
    expect(out).toContain('End the lab with a scoring rubric.');
  });
});