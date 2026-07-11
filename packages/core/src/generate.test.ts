import { describe, expect, it } from 'vitest';
import { MockProvider } from '@playgenx/providers';
import {
  generateFlashcards,
  generateLab,
  generatePlayground,
  generatePoll,
  generateQuiz,
  generateSimulation,
  parseFlashcardsBody,
  parsePollBody,
  parseQuizBody,
  type ArtifactResult,
} from './index.js';

function rawProvider(body: string): import('@playgenx/types').Provider {
  return {
    id: 'raw',
    defaultModel: 'raw-1',
    complete: async () => body,
  };
}

describe('generatePoll', () => {
  it('returns ok with kind="poll" for a valid JSON body', async () => {
    const json = JSON.stringify({
      question: 'What is 2 + 2?',
      options: [
        { id: 'a', label: '3' },
        { id: 'b', label: '4' },
      ],
    });
    const r = await generatePoll(
      { context: 'ctx', concept: 'c', kind: 'poll' },
      { provider: rawProvider('```json\n' + json + '\n```') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.kind).toBe('poll');
    expect(r.artifact.body).toContain('"question"');
  });

  it('rejects malformed JSON with a validate-stage error', async () => {
    const r = await generatePoll(
      { context: 'ctx', concept: 'c', kind: 'poll' },
      { provider: rawProvider('```json\n{not valid\n```') },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.stage).toBe('validate');
    expect(r.error.message).toMatch(/not valid JSON/);
  });

  it('rejects a poll with too-few options', async () => {
    const r = await generatePoll(
      { context: 'ctx', concept: 'c', kind: 'poll' },
      {
        provider: rawProvider(
          '```json\n' +
            JSON.stringify({
              question: 'q',
              options: [{ id: 'a', label: 'x' }],
            }) +
            '\n```',
        ),
      },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toMatch(/between 2 and 4/);
  });

  it('parsePollBody returns typed value on valid JSON', () => {
    const r = parsePollBody(
      JSON.stringify({
        question: 'q',
        options: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.question).toBe('q');
    expect(r.value.options).toHaveLength(2);
  });
});

describe('generateQuiz', () => {
  it('returns ok for valid quiz JSON', async () => {
    const json = JSON.stringify({
      questions: [
        {
          id: 'q1',
          prompt: 'p',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          answer: 'a',
        },
        {
          id: 'q2',
          prompt: 'p',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          answer: 'b',
        },
        {
          id: 'q3',
          prompt: 'p',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          answer: 'a',
        },
      ],
    });
    const r = await generateQuiz(
      { context: 'ctx', concept: 'c', kind: 'quiz' },
      { provider: rawProvider('```json\n' + json + '\n```') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.kind).toBe('quiz');
  });

  it('rejects a quiz whose answer does not match any option id', async () => {
    const r = await generateQuiz(
      { context: 'ctx', concept: 'c', kind: 'quiz' },
      {
        provider: rawProvider(
          '```json\n' +
            JSON.stringify({
              questions: [
                {
                  id: 'q1',
                  prompt: 'p',
                  options: [
                    { id: 'a', label: 'A' },
                    { id: 'b', label: 'B' },
                  ],
                  answer: 'z',
                },
                {
                  id: 'q2',
                  prompt: 'p',
                  options: [
                    { id: 'a', label: 'A' },
                    { id: 'b', label: 'B' },
                  ],
                  answer: 'a',
                },
                {
                  id: 'q3',
                  prompt: 'p',
                  options: [
                    { id: 'a', label: 'A' },
                    { id: 'b', label: 'B' },
                  ],
                  answer: 'a',
                },
              ],
            }) +
            '\n```',
        ),
      },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toMatch(/answer.*doesn't match/);
  });

  it('parseQuizBody returns typed value', () => {
    const r = parseQuizBody(
      JSON.stringify({
        questions: [
          {
            id: 'q1',
            prompt: 'p',
            options: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ],
            answer: 'a',
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.questions).toHaveLength(1);
  });
});

describe('generateSimulation', () => {
  it('returns ok for valid TSX', async () => {
    const tsx = '<Card><Heading>Step 1</Heading></Card>';
    const r = await generateSimulation(
      { context: 'ctx', concept: 'c', kind: 'simulation' },
      { provider: rawProvider('```tsx\n' + tsx + '\n```') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.kind).toBe('simulation');
  });
});

describe('generateFlashcards', () => {
  it('returns ok for valid flashcards JSON', async () => {
    const cards = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i + 1}`,
      front: `F${i + 1}`,
      back: `B${i + 1}`,
    }));
    const r = await generateFlashcards(
      { context: 'ctx', concept: 'c', kind: 'flashcards' },
      { provider: rawProvider('```json\n' + JSON.stringify({ cards }) + '\n```') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.kind).toBe('flashcards');
  });

  it('parseFlashcardsBody returns typed value', () => {
    const r = parseFlashcardsBody(
      JSON.stringify({
        cards: [
          { id: 'c1', front: 'F', back: 'B' },
          { id: 'c2', front: 'F', back: 'B' },
          { id: 'c3', front: 'F', back: 'B' },
          { id: 'c4', front: 'F', back: 'B' },
          { id: 'c5', front: 'F', back: 'B' },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.cards).toHaveLength(5);
  });
});

describe('generateLab', () => {
  it('returns ok for valid lab TSX', async () => {
    const tsx =
      '<Card><Heading>Lab: Binary Search</Heading><Button>Hint</Button></Card>';
    const r = await generateLab(
      { context: 'ctx', concept: 'c', kind: 'lab' },
      { provider: rawProvider('```tsx\n' + tsx + '\n```') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.kind).toBe('lab');
  });
});

describe('pipeline', () => {
  it('truncates a runaway response body', async () => {
    const huge = 'x'.repeat(500_000);
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider('```tsx\n' + huge + '\n```'), maxResponseBytes: 1000 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.body.length).toBeLessThan(2000);
    expect(r.artifact.body).toContain('truncated');
  });

  it('returns ok for a clean MockProvider-driven playground', async () => {
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: new MockProvider() },
    );
    expect(r.ok).toBe(true);
  });

  it('respects maxResponseBytes: 0 (disabled)', async () => {
    const huge = 'x'.repeat(500_000);
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider('```tsx\n' + huge + '\n```'), maxResponseBytes: 0 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.body.length).toBeGreaterThan(400_000);
  });
});

// Re-export test helper to avoid unused-import lint.
export type _TestResult = ArtifactResult;

// ──────────────────────── v0.2.x feature tests ────────────────────────

describe('retry on transient provider failures', () => {
  it('retries on ECONNRESET and succeeds on the second attempt', async () => {
    let attempt = 0;
    const flaky: import('@playgenx/types').Provider = {
      id: 'flaky',
      defaultModel: 'flaky-1',
      complete: async () => {
        attempt++;
        if (attempt === 1) {
          const e: Error & { code?: string } = new Error('connect ECONNRESET');
          e.code = 'ECONNRESET';
          throw e;
        }
        return '<Card><Text>ok</Text></Card>';
      },
    };
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: flaky, maxRetries: 2 },
    );
    expect(r.ok).toBe(true);
    expect(attempt).toBe(2);
  });

  it('does NOT retry on permanent failures (4xx other than 429)', async () => {
    let attempt = 0;
    const fail4xx: import('@playgenx/types').Provider = {
      id: 'fail4xx',
      defaultModel: 'fail4xx-1',
      complete: async () => {
        attempt++;
        const e: Error & { status?: number } = new Error('Bad request');
        e.status = 400;
        throw e;
      },
    };
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: fail4xx, maxRetries: 2 },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.stage).toBe('provider');
    expect(attempt).toBe(1);
  });

  it('returns RETRIES_EXHAUSTED after exhausting retries on persistent failures', async () => {
    const alwaysFail: import('@playgenx/types').Provider = {
      id: 'always',
      defaultModel: 'always-1',
      complete: async () => {
        const e: Error & { status?: number } = new Error('Server error');
        e.status = 503;
        throw e;
      },
    };
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: alwaysFail, maxRetries: 2, retryBaseMs: 1 }, // tiny base to keep test fast
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('PROVIDER_ERROR');
  });

  it('does not retry when maxRetries=0', async () => {
    let attempt = 0;
    const flaky: import('@playgenx/types').Provider = {
      id: 'flaky',
      defaultModel: 'flaky-1',
      complete: async () => {
        attempt++;
        const e: Error & { code?: string } = new Error('connect ECONNRESET');
        e.code = 'ECONNRESET';
        throw e;
      },
    };
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: flaky, maxRetries: 0 },
    );
    expect(r.ok).toBe(false);
    expect(attempt).toBe(1);
  });
});

describe('error codes', () => {
  it('sets PARSE_NO_FENCE / PARSE_UNBALANCED_FENCE for malformed responses', async () => {
    // "no fence at all" returns ok:true with kind='plain' (per the parser's
    // shape detection) — that's not an error. We test the unbalanced
    // and empty-fence cases which DO error.
    const empty = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider('```tsx\n```') },
    );
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.error.code).toBe('PARSE_EMPTY_FENCE');
  });

  it('sets PARSE_UNBALANCED_FENCE for an opened-but-not-closed fence', async () => {
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider('```tsx\nconst x = 1;') },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('PARSE_UNBALANCED_FENCE');
  });

  it('sets JSON_PARSE_FAILED when JSON is malformed', async () => {
    const r = await generatePoll(
      { context: 'ctx', concept: 'c', kind: 'poll' },
      { provider: rawProvider('```json\n{not json\n```') },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('JSON_PARSE_FAILED');
  });

  it('sets INVALID_JSON_SHAPE when JSON is valid but shape is wrong', async () => {
    const r = await generatePoll(
      { context: 'ctx', concept: 'c', kind: 'poll' },
      {
        provider: rawProvider(
          '```json\n' + JSON.stringify({ question: 'q' /* no options */ }) + '\n```',
        ),
      },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('INVALID_JSON_SHAPE');
  });

  it('sets UNKNOWN_COMPONENT for an unrecognized JSX tag', async () => {
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider('```tsx\n<NotInRegistry />\n```') },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('UNKNOWN_COMPONENT');
  });

  it('sets FORBIDDEN_CONSTRUCT when eval() is in the body', async () => {
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider('```tsx\nconst x = eval("1");\n```') },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('FORBIDDEN_CONSTRUCT');
  });

  it('sets PROVIDER_ERROR with providerId for a thrown provider error', async () => {
    const fail: import('@playgenx/types').Provider = {
      id: 'fail',
      defaultModel: 'fail-1',
      complete: async () => {
        throw new Error('provider blew up');
      },
    };
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: fail, maxRetries: 0 },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.stage).toBe('provider');
    expect(r.error.code).toBe('PROVIDER_ERROR');
    expect(r.error.providerId).toBe('fail');
  });

  it('sets TIMEOUT code (and does NOT retry) when our internal timeout fires', async () => {
    let attempt = 0;
    const timeoutProv: import('@playgenx/types').Provider = {
      id: 'timeout',
      defaultModel: 'timeout-1',
      complete: async () => {
        attempt++;
        // Simulate our own AbortController firing. The error has
        // name='AbortError' AND the __playgenxTimeout marker set.
        const err: Error & { __playgenxTimeout?: boolean } = new Error('aborted');
        err.name = 'AbortError';
        err.__playgenxTimeout = true;
        throw err;
      },
    };
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: timeoutProv, maxRetries: 3, retryBaseMs: 1 },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('TIMEOUT');
    // Crucially: only one attempt — internal timeouts are NOT retried.
    expect(attempt).toBe(1);
  });

  it('DOES retry on a user-supplied AbortError (without the __playgenxTimeout marker)', async () => {
    let attempt = 0;
    const userAbort: import('@playgenx/types').Provider = {
      id: 'user-abort',
      defaultModel: 'user-abort-1',
      complete: async () => {
        attempt++;
        // User-supplied AbortSignal: name='AbortError' but NO marker.
        // The retry layer treats this as transient.
        const err = new Error('aborted by user');
        err.name = 'AbortError';
        if (attempt < 2) throw err;
        return '<Card />';
      },
    };
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: userAbort, maxRetries: 2, retryBaseMs: 1 },
    );
    expect(r.ok).toBe(true);
    expect(attempt).toBe(2);
  });
});

describe('truncation warning', () => {
  it('returns ok with warning when maxResponseBytes truncates', async () => {
    const huge = 'x'.repeat(500_000);
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider('```tsx\n' + huge + '\n```'), maxResponseBytes: 1000 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.warning).toMatch(/truncated/);
  });

  it('does not set warning when response fits', async () => {
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: rawProvider('```tsx\n<Card />\n```') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.warning).toBeUndefined();
  });
});

describe('provider options passthrough', () => {
  it('passes maxTokens to provider.complete when set', async () => {
    let captured: { maxTokens?: number; timeoutMs?: number; model?: string } = {};
    const capturing: import('@playgenx/types').Provider = {
      id: 'cap',
      defaultModel: 'cap-1',
      complete: async (_prompt, opts) => {
        captured = {
          maxTokens: opts?.maxTokens,
          timeoutMs: opts?.timeoutMs,
          model: opts?.model,
        };
        return '<Card />';
      },
    };
    await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: capturing, maxTokens: 2000, timeoutMs: 30000, model: 'gpt-4o' },
    );
    expect(captured.maxTokens).toBe(2000);
    expect(captured.timeoutMs).toBe(30000);
    expect(captured.model).toBe('gpt-4o');
  });

  it('does not pass maxTokens when not set (preserves model default)', async () => {
    let captured: { maxTokens?: number } = {};
    const capturing: import('@playgenx/types').Provider = {
      id: 'cap',
      defaultModel: 'cap-1',
      complete: async (_prompt, opts) => {
        captured = { maxTokens: opts?.maxTokens };
        return '<Card />';
      },
    };
    await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: capturing },
    );
    expect(captured.maxTokens).toBeUndefined();
  });
});

// Determinism-fingerprint contract: PR 2 attached `id` and
// `promptFingerprint` to every successful artifact. These tests
// pin the shape so a future refactor doesn't silently drop them.
describe('Determinism fingerprints on generated artifacts', () => {
  function rawProvider(body: string): import('@playgenx/types').Provider {
    return {
      id: 'raw',
      defaultModel: 'raw-1',
      complete: async () => body,
    };
  }

  it('attaches a 64-hex-char id to every successful playground artifact', async () => {
    const r = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('attaches a 64-hex-char promptFingerprint', async () => {
    const r = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    if (!r.ok) return;
    expect(r.artifact.promptFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('id is stable for the same body+provider (re-rendered)', async () => {
    const a = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    const b = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    if (!a.ok || !b.ok) return;
    expect(a.artifact.id).toBe(b.artifact.id);
  });

  it('id changes when the body changes', async () => {
    const a = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    const b = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Text />') },
    );
    if (!a.ok || !b.ok) return;
    expect(a.artifact.id).not.toBe(b.artifact.id);
  });

  it('promptFingerprint changes when the concept changes (cache key for repeat calls)', async () => {
    const a = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    const b = await generatePlayground(
      { context: 'x', concept: 'z', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    if (!a.ok || !b.ok) return;
    expect(a.artifact.promptFingerprint).not.toBe(b.artifact.promptFingerprint);
  });

  it('promptFingerprint is stable for the same request inputs', async () => {
    const a = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    const b = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Card />') },
    );
    if (!a.ok || !b.ok) return;
    expect(a.artifact.promptFingerprint).toBe(b.artifact.promptFingerprint);
  });

  it('does NOT attach fingerprints when the validator rejects the body', async () => {
    const r = await generatePlayground(
      { context: 'x', concept: 'y', kind: 'playground' },
      { provider: rawProvider('<Button onClick={() => Math.random()} />') },
    );
    expect(r.ok).toBe(false);
  });

  it('attaches fingerprints for JSON-bodied kinds (poll) too', async () => {
    const json = JSON.stringify({
      question: 'q',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    });
    const r = await generatePoll(
      { context: 'x', concept: 'y', kind: 'poll' },
      { provider: rawProvider('```json\n' + json + '\n```') },
    );
    if (!r.ok) return;
    expect(r.artifact.id).toMatch(/^[0-9a-f]{64}$/);
    expect(r.artifact.promptFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});