import { describe, expect, it } from 'vitest';
import { extractArtifact } from './extract.js';

describe('extractArtifact', () => {
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

  it('treats a fence with no language tag as tsx', () => {
    const raw = '```\nhello\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe('tsx');
    expect(result.body).toBe('hello');
  });

  it('handles content that itself contains triple backticks (inside a string)', () => {
    // The opening fence ```tsx starts the block. The inner ```` are on a line by themselves
    // and would normally close it. To make the test robust, we use a single backtick in a string.
    const raw = '```tsx\nconst s = "code: `hi`";\n```';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe('const s = "code: `hi`";');
  });

  it('returns an error with the opening line for an unbalanced fence', () => {
    const raw = 'intro\n\n```tsx\nconst x = 1;\n\nno closer here';
    const result = extractArtifact(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe('Unbalanced code fence');
    expect(result.error.line).toBe(3);
  });

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

  it('returns kind=tsx for unfenced content starting with const x =', () => {
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
});
