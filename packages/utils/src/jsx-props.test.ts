import { describe, expect, it } from 'vitest';
import { propsOfTag } from './jsx-props.js';

describe('propsOfTag', () => {
  it('returns [] when the tag does not appear', () => {
    expect(propsOfTag('<div />', 'Button')).toEqual([]);
  });

  it('extracts string-literal props', () => {
    const out = propsOfTag('<Button label="Go" />', 'Button');
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe('label');
    expect(out[0]?.kind).toBe('string');
    expect(out[0]?.value).toBe('"Go"');
  });

  it('extracts numeric expression props', () => {
    const out = propsOfTag('<Slider min={0} max={10} value={5} />', 'Slider');
    expect(out.map((p) => p.name)).toEqual(['min', 'max', 'value']);
    expect(out.every((p) => p.kind === 'number')).toBe(true);
  });

  it('extracts boolean expression props', () => {
    const out = propsOfTag('<Button label="x" disabled={true} />', 'Button');
    expect(out.find((p) => p.name === 'disabled')?.kind).toBe('boolean');
  });

  it('treats a bare attribute as boolean true', () => {
    const out = propsOfTag('<Button label="x" disabled />', 'Button');
    expect(out.find((p) => p.name === 'disabled')).toEqual({
      name: 'disabled',
      kind: 'boolean',
      value: 'true',
    });
  });

  it('extracts props across multiple tags of the same name', () => {
    const body = '<Button label="A" /><Button label="B" />';
    const out = propsOfTag(body, 'Button');
    expect(out).toHaveLength(2);
    expect(out[0]?.value).toBe('"A"');
    expect(out[1]?.value).toBe('"B"');
  });

  it('classifies expression props that reference identifiers', () => {
    const out = propsOfTag('<Chart data={chartData} />', 'Chart');
    expect(out[0]?.name).toBe('data');
    expect(out[0]?.kind).toBe('expression');
  });

  it('ignores string literals containing a tag-like name', () => {
    const out = propsOfTag('<div title="<Button />" />', 'Button');
    expect(out).toEqual([]);
  });

  it('handles deeply nested braces in expression values', () => {
    const out = propsOfTag(
      '<Card data={{ a: { b: 1 } }} />',
      'Card',
    );
    expect(out[0]?.kind).toBe('expression');
    expect(out[0]?.value).toContain('a:');
  });

  it('handles whitespace and newlines between props', () => {
    const out = propsOfTag(
      `<Button
        label="x"
        disabled={true}
      />`,
      'Button',
    );
    expect(out.map((p) => p.name)).toEqual(['label', 'disabled']);
  });
});
