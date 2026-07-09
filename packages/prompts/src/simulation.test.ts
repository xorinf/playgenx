import { describe, expect, it } from 'vitest';
import { simulationPrompt } from './simulation.js';

describe('simulationPrompt', () => {
  it('includes the target concept and lecture context', () => {
    const out = simulationPrompt({
      context: 'A lecture on quicksort partitioning.',
      concept: 'quicksort',
      kind: 'simulation',
    });
    expect(out).toContain('quicksort');
    expect(out).toContain('A lecture on quicksort partitioning.');
  });

  it('asks for a TSX simulation with state and progression', () => {
    const out = simulationPrompt({ context: 'x', concept: 'y', kind: 'simulation' });
    expect(out).toMatch(/simulation/i);
    expect(out).toContain('```tsx');
    expect(out).toMatch(/state|progress|motion/);
  });

  it('appends caller-provided override instructions when present', () => {
    const out = simulationPrompt({
      context: 'ctx',
      concept: 'c',
      kind: 'simulation',
      promptOverride: 'Use Canvas for the visualization.',
    });
    expect(out).toContain('Use Canvas for the visualization.');
  });
});