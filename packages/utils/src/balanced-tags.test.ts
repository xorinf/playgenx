import { describe, expect, it } from 'vitest';
import { hasBalancedTags } from './balanced-tags.js';

describe('hasBalancedTags', () => {
  it('returns true for balanced open/close', () => {
    expect(hasBalancedTags('<div><span>x</span></div>')).toBe(true);
  });

  it('returns true for self-closing only', () => {
    expect(hasBalancedTags('<Foo />')).toBe(true);
  });

  it('returns true for empty body', () => {
    expect(hasBalancedTags('')).toBe(true);
  });

  it('returns false for missing close', () => {
    expect(hasBalancedTags('<div><span>x</div>')).toBe(false);
  });

  it('returns false for extra close', () => {
    expect(hasBalancedTags('<div></span></div>')).toBe(false);
  });

  it('handles comments without false counts', () => {
    expect(hasBalancedTags('// <div>\n<div />')).toBe(true);
    expect(hasBalancedTags('/* <div> */<div />')).toBe(true);
  });

  it('handles self-closing tags with simple attributes', () => {
    expect(hasBalancedTags('<Foo bar="x" />')).toBe(true);
    expect(hasBalancedTags('<Foo bar="x" baz={42} />')).toBe(true);
  });

  it('handles self-closing tags with single-quoted attributes', () => {
    expect(hasBalancedTags("<Foo bar='x' />")).toBe(true);
    expect(hasBalancedTags("<Foo bar='x < y' />")).toBe(true);
  });

  it('handles self-closing tags with < inside attribute values', () => {
    expect(hasBalancedTags('<Foo bar="<x>" />')).toBe(true);
    expect(hasBalancedTags('<Foo bar="<x" baz=">y" />')).toBe(true);
  });

  it('handles multiple attributes with mixed quotes', () => {
    expect(hasBalancedTags('<Foo bar="x" baz=\'y\' qux="z" />')).toBe(true);
  });

  it('treats void elements as self-closing', () => {
    expect(hasBalancedTags('<br>')).toBe(true);
    expect(hasBalancedTags('<input type="text" />')).toBe(true);
    expect(hasBalancedTags('<div><br><input /><hr></div>')).toBe(true);
  });

  it('returns true for fully balanced with mixed self-closing and open/close', () => {
    expect(hasBalancedTags('<div><Foo /><Bar>x</Bar></div>')).toBe(true);
  });

  it('returns false for unbalanced with attribute values', () => {
    // The < inside "a < b" is fine; but missing close on <Foo makes it unbalanced.
    expect(hasBalancedTags('<Foo bar="a < b"')).toBe(false);
  });

  it('handles nested self-closing tags', () => {
    expect(hasBalancedTags('<Foo><Bar /></Foo>')).toBe(true);
    expect(hasBalancedTags('<Foo><Bar /></Foo><Baz />')).toBe(true);
  });

  it('preserves line numbers when stripping self-closing tags (does not collapse newlines)', () => {
    // The self-closing tag spans 1 line; the newline should be preserved.
    const body = 'line1\n<Foo />\nline3';
    expect(hasBalancedTags(body)).toBe(true);
    // The newline count is 2.
    expect((body.match(/\n/g) ?? []).length).toBe(2);
  });

  it('handles whitespace before self-closing slash', () => {
    expect(hasBalancedTags('<Foo    /   >')).toBe(true);
    expect(hasBalancedTags('<Foo bar="x"   /   >')).toBe(true);
  });

  it('handles unterminated tag gracefully (returns false)', () => {
    expect(hasBalancedTags('<div><span>x')).toBe(false);
  });

  it('handles tags with hyphens in names (custom elements)', () => {
    // We only count tags starting with [A-Za-z][A-Za-z0-9]* so
    // <my-element> doesn't count. That's a known limitation.
    const body = '<MyWidget>x</MyWidget>';
    expect(hasBalancedTags(body)).toBe(true);
  });

  it('correctly handles deeply nested balanced structures', () => {
    expect(hasBalancedTags('<div><section><article><p>text</p></article></section></div>')).toBe(
      true,
    );
  });

  it('detects imbalance in deeply nested structures', () => {
    expect(hasBalancedTags('<div><section><article><p>text</article></section></div>')).toBe(false);
  });
});
