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
});
