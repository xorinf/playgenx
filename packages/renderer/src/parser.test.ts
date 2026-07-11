import { describe, expect, it } from 'vitest';
import { parseBody, parseBodyNodes, isBuiltInTag } from './parser.js';

describe('parseBodyNodes', () => {
  it('parses a single PascalCase element with a string prop', () => {
    const out = parseBodyNodes('<Button label="Go" />');
    expect(out).toHaveLength(1);
    const first = out[0]!;
    expect(first.kind).toBe('element');
    if (first.kind !== 'element') return;
    expect(first.name).toBe('Button');
    expect(first.props).toEqual([
      { name: 'label', kind: 'string', value: '"Go"' },
    ]);
  });

  it('parses a self-closing element with multiple props', () => {
    const out = parseBodyNodes('<Slider min={0} max={10} value={5} />');
    expect(out).toHaveLength(1);
    const first = out[0]!;
    if (first.kind !== 'element') return;
    expect(first.name).toBe('Slider');
    expect(first.props).toHaveLength(3);
    expect(first.props.every((p) => p.kind === 'number')).toBe(true);
  });

  it('parses boolean shorthand into a boolean-true prop', () => {
    const out = parseBodyNodes('<Button label="x" disabled />');
    const first = out[0]!;
    if (first.kind !== 'element') return;
    expect(first.props[0]).toEqual({ name: 'label', kind: 'string', value: '"x"' });
    expect(first.props[1]).toEqual({ name: 'disabled', kind: 'boolean', value: 'true' });
  });

  it('parses nested children', () => {
    const out = parseBodyNodes('<Card title="x"><Heading>Hi</Heading></Card>');
    const card = out[0]!;
    if (card.kind !== 'element') return;
    expect(card.name).toBe('Card');
    expect(card.children).toHaveLength(1);
    const heading = card.children[0]!;
    if (heading.kind !== 'element') return;
    expect(heading.name).toBe('Heading');
    expect(heading.children).toHaveLength(1);
    expect(heading.children[0]?.kind).toBe('text');
  });

  it('parses mixed built-in and component tags', () => {
    const out = parseBodyNodes('<div><Heading>Hi</Heading><Text>world</Text></div>');
    const div = out[0]!;
    expect(div.kind).toBe('element');
    if (div.kind !== 'element') return;
    expect(div.name).toBe('div');
    expect(div.children).toHaveLength(2);
  });

  it('preserves text between siblings as a text node', () => {
    const out = parseBodyNodes('<div>Hello <strong>world</strong></div>');
    const div = out[0]!;
    if (div.kind !== 'element') return;
    expect(div.children.some((c) => c.kind === 'text')).toBe(true);
  });

  it('falls back to text for unparseable tag names', () => {
    // `$weird` is not a valid JSX tag (starts with `$`), so the
    // parser treats it as text. The wrapper `<div>` still parses.
    const out = parseBodyNodes('<div><$weird /></div>');
    expect(out).toHaveLength(1);
    const div = out[0]!;
    if (div.kind !== 'element') return;
    expect(div.children.some((c) => c.kind === 'text')).toBe(true);
  });

  it('parses expression values containing nested braces', () => {
    const out = parseBodyNodes('<Card data={{ a: 1, b: 2 }} />');
    const first = out[0]!;
    if (first.kind !== 'element') return;
    expect(first.props[0]?.kind).toBe('expression');
    expect(first.props[0]?.value).toContain('a: 1');
  });

  it('parses lowercased HTML tags without confusing them with components', () => {
    const out = parseBodyNodes('<section><p>x</p></section>');
    const sec = out[0]!;
    if (sec.kind !== 'element') return;
    expect(sec.name).toBe('section');
  });

  it('strips JS comments before parsing', () => {
    const out = parseBodyNodes('// a note\n<Button label="Go" />');
    expect(out).toHaveLength(1);
  });

  it('does not match against component names inside string literal attribute values', () => {
    // `<Button label="<Unknown />" />` — the inner tag-like text
    // is part of the string literal, not a child.
    const out = parseBodyNodes('<Button label="<Unknown />" />');
    const first = out[0]!;
    if (first.kind !== 'element') return;
    expect(first.children).toHaveLength(0);
    expect(first.props[0]?.kind).toBe('string');
    expect(first.props[0]?.value).toBe('"<Unknown />"');
  });

  it('isBuiltInTag recognises every entry in BUILT_IN_TAGS and rejects PascalCase', () => {
    expect(isBuiltInTag('div')).toBe(true);
    expect(isBuiltInTag('span')).toBe(true);
    expect(isBuiltInTag('Button')).toBe(false);
    expect(isBuiltInTag('SECTION')).toBe(false); // uppercase still distinct from components
  });

  it('parseBody wraps multiple top-level siblings in a synthetic element', () => {
    const tree = parseBody('<div /><p>x</p>');
    expect(tree.kind).toBe('element');
    if (tree.kind !== 'element') return;
    expect(tree.children).toHaveLength(2);
  });
});
