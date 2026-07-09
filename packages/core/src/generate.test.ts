import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTRY, createRegistry } from '@playgenx/registry';
import { MockProvider } from '@playgenx/providers';
import { generatePlayground } from './generate.js';

describe('generatePlayground', () => {
  it('returns an ok Artifact using the injected provider', async () => {
    // MockProvider returns the prompt itself, which the parser/validator will accept
    // because the prompt does not contain any forbidden constructs and the test
    // body doesn't either.
    const result = await generatePlayground(
      { context: 'Lecture on binary search.', concept: 'binary search', kind: 'playground' },
      { provider: new MockProvider() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.artifact.kind).toBe('playground');
    expect(result.artifact.providerId).toBe('mock');
    expect(result.artifact.model).toBe('mock-1');
  });

  it('respects a model override', async () => {
    const result = await generatePlayground(
      { context: 'ctx', concept: 'recursion', kind: 'playground' },
      { provider: new MockProvider(), model: 'mock-2' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.model).toBe('mock-2');
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
    expect(result.error.stage).toBe('provider');
    expect(result.error.message).toBe('boom');
  });

  it('returns a parse error for unbalanced fence output', async () => {
    const rawProvider: import('@playgenx/types').Provider = {
      id: 'raw',
      defaultModel: 'raw-1',
      complete: async () => '```tsx\nconst x = 1;', // missing closing fence
    };

    const result = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe('parse');
    expect(result.error.message).toMatch(/Unbalanced/);
  });

  it('returns a validate error for an unknown component', async () => {
    const rawProvider: import('@playgenx/types').Provider = {
      id: 'raw',
      defaultModel: 'raw-1',
      complete: async () => '```tsx\n<MyEvilComponent />\n```',
    };

    const result = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider, registry: createRegistry([]) },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe('validate');
    expect(result.error.message).toMatch(/Unknown component: MyEvilComponent/);
  });

  it('uses the default registry when none is passed', async () => {
    const rawProvider: import('@playgenx/types').Provider = {
      id: 'raw',
      defaultModel: 'raw-1',
      complete: async () => '```tsx\n<Card><Text>hi</Text></Card>\n```',
    };

    const result = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider },
    );

    expect(result.ok).toBe(true);
  });

  it('uses the supplied registry when provided', async () => {
    const rawProvider: import('@playgenx/types').Provider = {
      id: 'raw',
      defaultModel: 'raw-1',
      complete: async () => '```tsx\n<MyWidget />\n```',
    };

    // No MyWidget in default registry → fails.
    const fails = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider },
    );
    expect(fails.ok).toBe(false);

    // With MyWidget in custom registry → passes.
    const passes = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider, registry: createRegistry(['MyWidget']) },
    );
    expect(passes.ok).toBe(true);
  });

  it('lets the caller plug in a custom validator', async () => {
    const rawProvider: import('@playgenx/types').Provider = {
      id: 'raw',
      defaultModel: 'raw-1',
      complete: async () => '```tsx\n<X />\n```',
    };

    const result = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      {
        provider: rawProvider,
        validate: () => 'blocked by my custom validator',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe('validate');
    expect(result.error.message).toBe('blocked by my custom validator');
  });

  it('returns a validate error for forbidden constructs (eval)', async () => {
    const rawProvider: import('@playgenx/types').Provider = {
      id: 'raw',
      defaultModel: 'raw-1',
      complete: async () => '```tsx\nconst x = eval("1");\n```',
    };

    const result = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe('validate');
    expect(result.error.message).toMatch(/eval/);
  });

  it('default registry is exported from @playgenx/registry', () => {
    // Sanity check that the import path we use internally matches the public one.
    expect(DEFAULT_REGISTRY.isAllowed('Button')).toBe(true);
  });
});
