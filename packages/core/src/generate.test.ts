import { describe, it, expect } from 'vitest';
import { MockProvider } from '@playgenx/providers';
import { generatePlayground } from './generate.js';

describe('generatePlayground', () => {
  it('returns an ok Artifact using the injected provider', async () => {
    const result = await generatePlayground(
      { context: 'Lecture on binary search.', concept: 'binary search', kind: 'playground' },
      { provider: new MockProvider() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.artifact.kind).toBe('playground');
    expect(result.artifact.providerId).toBe('mock');
    expect(result.artifact.model).toBe('mock-1');
    expect(result.artifact.body).toContain('binary search');
  });

  it('respects a model override', async () => {
    const result = await generatePlayground(
      { context: 'ctx', concept: 'recursion', kind: 'playground' },
      { provider: new MockProvider(), model: 'mock-2' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.model).toBe('mock-2');
    expect(result.artifact.body).toContain('mock-2');
  });

  it('returns an error result when the provider throws', async () => {
    const failing: import('@playgenx/types').Provider = {
      id: 'failing',
      defaultModel: 'fail-1',
      complete: async () => {
        throw new Error('boom');
      },
    };

    const result = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: failing },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.providerId).toBe('failing');
    expect(result.error.message).toBe('boom');
  });
});