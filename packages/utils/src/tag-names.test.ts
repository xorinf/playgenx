import { describe, expect, it } from 'vitest';
import { tagNames } from './tag-names.js';

describe('tagNames', () => {
  it('returns capitalized JSX tag names', () => {
    expect(tagNames('<Card><Text>hi</Text></Card>')).toEqual(['Card', 'Text']);
  });

  it('deduplicates repeated tags', () => {
    expect(tagNames('<Foo /><Foo /><Foo />')).toEqual(['Foo']);
  });

  it('ignores lowercase HTML tags', () => {
    expect(tagNames('<div><span>x</span></div>')).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(tagNames('')).toEqual([]);
  });

  it('extracts multiple distinct tags in any order', () => {
    const result = tagNames('<Chart data={x}><Heading /><Button /></Chart>');
    expect(result.sort()).toEqual(['Button', 'Chart', 'Heading']);
  });

  it('ignores tags inside line comments', () => {
    expect(tagNames('// <Button> here\n<RealWidget />')).toEqual(['RealWidget']);
  });

  it('ignores tags inside block comments', () => {
    expect(tagNames('/* <Button> here */ <RealWidget />')).toEqual(['RealWidget']);
  });

  it('ignores tags inside double-quoted strings', () => {
    expect(tagNames('const s = "<Button>"; <RealWidget />')).toEqual(['RealWidget']);
  });

  it('ignores tags inside single-quoted strings', () => {
    expect(tagNames("const s = '<Button>'; <RealWidget />")).toEqual(['RealWidget']);
  });

  it('ignores tags inside template literals', () => {
    expect(tagNames('const s = `<Button>`; <RealWidget />')).toEqual(['RealWidget']);
  });

  it('handles escaped quotes inside strings (does not exit early)', () => {
    expect(tagNames('const s = "<Button>\\"<More>"; <RealWidget />')).toEqual([
      'RealWidget',
    ]);
  });

  it('preserves tag names that are adjacent to other text', () => {
    // No whitespace between tags — common in generated JSX.
    expect(tagNames('<Foo><Bar /></Foo>')).toEqual(['Foo', 'Bar']);
  });
});