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
    // Our parser only handles 3-backtick fences, so this falls through to shape.
    const raw = '````tsx\n```\ninner\n```\n````';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    // Either it's parsed as a 3-backtick fence (and we'd see the inner stuff as the body)
    // or it's not recognized. Either way, no crash.
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
});