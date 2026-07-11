import { describe, expect, it } from 'vitest';
import { extractArtifact } from './extract.js';

describe('extractArtifact', () => {
  // ────────────────── happy path ──────────────────
  it('extracts a fenced tsx block with content', () => {
    const raw = 'Here you go:\n\n```tsx\nconst x = 1;\n```\n\nHave fun!';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
    expect(result.body).toBe('const x = 1;');
  });

  it('extracts a fenced html block', () => {
    const raw = '```html\n<div>hi</div>\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('html');
    expect(result.body).toBe('<div>hi</div>');
  });

  it('treats fenced jsx as tsx', () => {
    const raw = '```jsx\n<div />\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
  });

  it('treats fenced json as tsx-shaped (body is still JSON text)', () => {
    const raw = '```json\n{"a": 1}\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx'); // parser doesn't parse JSON; core handles kind-specific skipping
    expect(result.body).toBe('{"a": 1}');
  });

  it('treats a fence with no language tag as tsx', () => {
    const raw = '```\nhello\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
    expect(result.body).toBe('hello');
  });

  // ────────────────── whitespace + BOM ──────────────────
  it('handles content with single backticks inside strings', () => {
    const raw = '```tsx\nconst s = "code: `hi`";\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe('const s = "code: `hi`";');
  });

  it('parses a fence with extra whitespace on the fence line', () => {
    const raw = '```   tsx   \nconst x = 1;\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
    expect(result.body).toBe('const x = 1;');
  });

  it('strips a leading BOM if present', () => {
    const raw = '\uFEFF```tsx\nconst x = 1;\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
    expect(result.body).toBe('const x = 1;');
  });

  it('handles CRLF line endings', () => {
    const raw = '```tsx\r\nconst x = 1;\r\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe('const x = 1;');
  });

  // ────────────────── edge cases ──────────────────
  it('returns an error with the opening line for an unbalanced fence', () => {
    const raw = 'intro\n\n```tsx\nconst x = 1;\n\nno closer here';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe('Unbalanced code fence');
    expect(result.error.line).toBe(3);
  });

  it('does NOT treat mid-line backticks as a fence (falls through to shape)', () => {
    // Common LLM pattern: "here's the code: ```tsx\n...\n```"
    // The leading "here's the code:" makes the backticks NOT a fence.
    // Result: the parser falls through to shape detection and returns the
    // whole input as the body. Caller deals with leading prose.
    const raw = "here's the code: ```tsx\nconst x = 1;\n```";
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Falls through to shape detection: starts with 'h' (not <, not
    // function/const/etc), so kind is 'plain'.
    expect(result.kind).toBe('plain');
    expect(result.body).toBe(raw);
  });

  it('handles multiple fenced blocks (returns the first)', () => {
    const raw = '```tsx\nconst x = 1;\n```\n\n```html\n<div>second</div>\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe('const x = 1;');
  });

  it('handles tilde-style code fences (~~~)', () => {
    // Some LLMs and humans use ~~~ for code fences. We support both.
    const raw = '~~~\nconst x = 1;\n~~~';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
    expect(result.body).toBe('const x = 1;');
  });

  it('handles 4-backtick fences by treating the inner ``` as content', () => {
    // ````tsx ... ```` — 4 backticks wrap a 3-backtick block.
    // Our parser only handles 3-backtick fences, so the inner pair (which
    // has an empty body in this test case) is the "outer" fence; "inner"
    // lives outside any fence and ends up as part of the (still empty)
    // body. The parser correctly returns an "Empty code fence" error.
    // Either way, no crash, no malformed result.
    const raw = '````tsx\n```\ninner\n```\n````';
    const result = extractArtifact(raw);
    // Strict expectation: empty body inside a fence is now an error.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Empty code fence|Unbalanced/);
  });

  it('extracts from a fence preceded by prose on a different line', () => {
    const raw = 'Here is the code:\n\n```tsx\nconst x = 1;\n```\n';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe('const x = 1;');
  });

  // ────────────────── unfenced content ──────────────────
  it('returns kind=plain for unfenced plain text', () => {
    const result = extractArtifact('just a sentence about binary search');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('plain');
    expect(result.body).toBe('just a sentence about binary search');
  });

  it('returns kind=tsx for unfenced content starting with < and containing </', () => {
    const result = extractArtifact('<div><span>hi</span></div>');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
    expect(result.body).toBe('<div><span>hi</span></div>');
  });

  it('returns kind=tsx for unfenced content starting with function', () => {
    const result = extractArtifact('function add(a, b) { return a + b; }');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
  });

  it('returns kind=tsx for unfenced content starting with const', () => {
    const result = extractArtifact('const x = 42;');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
  });

  it('returns kind=tsx for unfenced content starting with class', () => {
    const result = extractArtifact('class Foo {}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
  });

  it('returns kind=tsx for unfenced content starting with import', () => {
    // Shouldn't happen in real generated output (we reject imports),
    // but the parser's shape-detect should recognize it.
    const result = extractArtifact('import x from "y";');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
  });

  it('returns kind=plain with empty body for empty string', () => {
    const result = extractArtifact('');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('plain');
    expect(result.body).toBe('');
  });

  it('returns kind=plain for whitespace-only string', () => {
    const result = extractArtifact('   \n\n\t  \n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('plain');
    expect(result.body).toBe('');
  });

  it('does not crash on very large input', () => {
    const big = '```tsx\n' + 'x'.repeat(100_000) + '\n```';
    const result = extractArtifact(big);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.length).toBe(100_000);
  });

  it('returns kind=plain for JSON-looking text without a fence (e.g. LLM forgot the fence)', () => {
    // Real LLM output often misses the fence. The parser should still
    // return the body — the validator will then check that the JSON
    // parses (added in a later patch).
    const result = extractArtifact('{"question": "x", "options": []}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe('{"question": "x", "options": []}');
    // kind is 'plain' because shape-detect doesn't classify JSON-looking
    // text as tsx (doesn't start with <, function, etc).
    expect(result.kind).toBe('plain');
  });

  // ────────────────── thinking-tag stripping (v0.2.x) ──────────────────
  describe('thinking tag stripping', () => {
    it('strips a single <think> block before the fence', () => {
      const raw =
        '<think>The user wants a quiz. Let me plan 5 questions.\n' +
        'Question 1 about binary search.\n</think>\n' +
        '```json\n{"questions": []}\n```';
      const result = extractArtifact(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.kind).toBe('tsx');
      expect(result.source).toBe('fence');
      expect(result.body).toBe('{"questions": []}');
    });

    it('strips multiple think blocks (non-greedy)', () => {
      const raw =
        '<think>first thoughts</think>\n' +
        '```tsx\n' +
        'const x = 1;\n' +
        '```\n' +
        '<think>a follow-up thought</think>';
      const result = extractArtifact(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.body).toBe('const x = 1;');
    });

    it('strips thinking tags case-insensitively (<think>, <THINK>, <Think>)', () => {
      for (const tag of ['think', 'THINK', 'Think', 'tHiNk']) {
        const raw = `<${tag}>scratch</${tag}>\n\`\`\`tsx\nbody\n\`\`\``;
        const result = extractArtifact(raw);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.body).toBe('body');
      }
    });

    it('strips <thinking>, <thought>, <reasoning>, <reflection>, <scratchpad>, <analysis>', () => {
      const tags = ['thinking', 'thought', 'reasoning', 'reflection', 'scratchpad', 'analysis'];
      for (const tag of tags) {
        const raw = `<${tag}>scratch</${tag}>\n\`\`\`tsx\nbody\n\`\`\``;
        const result = extractArtifact(raw);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.body).toBe('body');
      }
    });

    it('strips Chinese thinking tags (o1思考, 思考)', () => {
      const raw = '<o1思考>scratch</o1思考>\n```tsx\nbody\n```';
      const result = extractArtifact(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.body).toBe('body');
    });

    it('strips HTML/XML comments', () => {
      const raw = '<!-- TODO: write the artifact -->\n```tsx\nbody\n```';
      const result = extractArtifact(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.body).toBe('body');
    });

    it('strips thinking tags inside an unfenced response', () => {
      // No fence. After stripping the think block, the remaining body
      // starts with `<div>` so shape-detect classifies as tsx.
      const raw = '<think>I should write JSX</think><div>hi</div>';
      const result = extractArtifact(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.body).toBe('<div>hi</div>');
      expect(result.kind).toBe('tsx');
      expect(result.source).toBe('shape');
    });

    it('preserves content outside thinking blocks when stripping', () => {
      const raw =
        '<think>I will think about this carefully.</think>\n' +
        'Here is the artifact:\n' +
        '```tsx\nconst x = 42;\n```\n' +
        'Hope that helps!';
      const result = extractArtifact(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.body).toBe('const x = 42;');
    });

    it('strips BOM plus thinking tag together', () => {
      const raw = '﻿<think>scratch</think>\n```tsx\nbody\n```';
      const result = extractArtifact(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.body).toBe('body');
    });

    it('handles think block that contains newlines and quotes', () => {
      const raw = `<think>Let me think about "binary search"
and edge cases like empty arrays.
</think>\`\`\`tsx
const x = 1;
\`\`\``;
      const result = extractArtifact(raw);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.body).toBe('const x = 1;');
    });

    it('exports stripThinkingTags as a standalone helper', async () => {
      const { stripThinkingTags } = await import('./extract.js');
      expect(stripThinkingTags('<think>x</think>body')).toBe('body');
      expect(stripThinkingTags('plain body')).toBe('plain body');
    });
  });

  // ────────────────── empty fence body ──────────────────
  it('returns an error for an empty fence body (model emitted nothing inside)', () => {
    const raw = '```tsx\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Empty code fence/);
  });

  it('returns an error when only a thinking block was inside a fence', () => {
    // Real failure mode: model writes ````tsx\n<think>...</think>\n```\n`.
    const raw = '```tsx\n<think>all my output was thinking</think>\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Empty code fence/);
  });
});
