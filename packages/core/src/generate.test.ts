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