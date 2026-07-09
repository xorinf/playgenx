// This pattern is what the apps/playground dev UI uses, but stripped
// down to a single test. Drop it into a vitest file.
//
// Run me: pnpm test examples/04-mock-tests.ts

import { describe, expect, it, vi } from 'vitest';
import { generatePlayground, MockProvider } from '@playgenx/core';

describe('generatePlayground (mocked)', () => {
  it('returns the prompt-shaped body from MockProvider', async () => {
    const result = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: new MockProvider() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.body).toContain('Target concept: c');
  });

  it('surfaces provider errors with the provider stage', async () => {
    const provider = {
      id: 'test',
      defaultModel: 'test-1',
      complete: vi.fn().mockRejectedValue(new Error('upstream down')),
    };

    const result = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe('provider');
    expect(result.error.message).toBe('upstream down');
  });
});
