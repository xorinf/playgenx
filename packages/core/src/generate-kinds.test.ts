import { describe, expect, it } from 'vitest';
import { MockProvider } from '@playgenx/providers';
import {
  generateFlashcards,
  generateLab,
  generatePlayground,
  generatePoll,
  generateQuiz,
  generateSimulation,
} from './generate.js';

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
    expect(r.artifact.body).toContain('"options"');
  });

  it('skips JSX-tag balance check on JSON bodies', async () => {
    // Body has no JSX tags — without skipJsxCheck the `[]` and `{}` braces
    // would skew the tag balance count and could fail. With skipJsxCheck
    // passed through runPipeline, it should pass.
    const json = JSON.stringify({
      question: 'q',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    });
    const r = await generatePoll(
      { context: 'ctx', concept: 'c', kind: 'poll' },
      { provider: rawProvider('```json\n' + json + '\n```') },
    );
    expect(r.ok).toBe(true);
  });
});

describe('generateQuiz', () => {
  it('returns ok with kind="quiz" for a valid JSON body', async () => {
    const json = JSON.stringify({
      questions: [
        {
          id: 'q1',
          prompt: 'Pick A',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          answer: 'a',
        },
        {
          id: 'q2',
          prompt: 'Pick B',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          answer: 'b',
        },
        {
          id: 'q3',
          prompt: 'Pick C',
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
});

describe('generateSimulation', () => {
  it('returns ok with kind="simulation" for a TSX body', async () => {
    const tsx = '<Card><Heading>Step 1</Heading></Card>';
    const r = await generateSimulation(
      { context: 'ctx', concept: 'c', kind: 'simulation' },
      { provider: rawProvider('```tsx\n' + tsx + '\n```') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.kind).toBe('simulation');
    expect(r.artifact.body).toContain('<Card>');
  });

  it('rejects unknown components in simulation bodies', async () => {
    const tsx = '<MyEvil />';
    const r = await generateSimulation(
      { context: 'ctx', concept: 'c', kind: 'simulation' },
      { provider: rawProvider('```tsx\n' + tsx + '\n```') },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.stage).toBe('validate');
    expect(r.error.message).toMatch(/Unknown component/);
  });
});

describe('generateFlashcards', () => {
  it('returns ok with kind="flashcards" for a valid JSON body', async () => {
    const cards = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i + 1}`,
      front: `Front ${i + 1}`,
      back: `Back ${i + 1}`,
    }));
    const json = JSON.stringify({ cards });
    const r = await generateFlashcards(
      { context: 'ctx', concept: 'c', kind: 'flashcards' },
      { provider: rawProvider('```json\n' + json + '\n```') },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.artifact.kind).toBe('flashcards');
  });
});

describe('generateLab', () => {
  it('returns ok with kind="lab" for a TSX body', async () => {
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

describe('generatePlayground (regression)', () => {
  it('still works after refactor', async () => {
    const r = await generatePlayground(
      { context: 'ctx', concept: 'c', kind: 'playground' },
      { provider: new MockProvider() },
    );
    expect(r.ok).toBe(true);
  });
});