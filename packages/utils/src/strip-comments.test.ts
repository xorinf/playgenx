import { describe, expect, it } from 'vitest';
import { lineOfFirst, stripCodeComments } from './strip-comments.js';

describe('stripCodeComments', () => {
  it('strips // line comments', () => {
    // Input:  'a; // b\nc;'  — that's `a;` + ` ` + `// b` (4 chars, replaced by 4 spaces) + `\n`
    // Result: 'a;     \nc;'   (5 spaces total between 'a;' and '\n')
    expect(stripCodeComments('a; // b\nc;')).toBe('a;     \nc;');
  });

  it('strips /* block */ comments', () => {
    // Input:  'a; /* b */ c;' — 'a; ' + '/* b */' (7 chars, replaced) + ' c;'
    // Result: 'a;         c;'   (9 spaces between 'a;' and 'c')
    expect(stripCodeComments('a; /* b */ c;')).toBe('a;         c;');
  });

  it('strips multi-line block comments', () => {
    const result = stripCodeComments('a;\n/* line1\nline2 */\nb;');
    // All three original lines should still be there.
    expect(result.split('\n').length).toBe(4);
  });

  it('preserves line count', () => {
    const input = 'a;\n// b\nc;\n';
    const result = stripCodeComments(input);
    expect(result.split('\n').length).toBe(input.split('\n').length);
  });
});

describe('lineOfFirst', () => {
  it('returns 1 for matches on the first line', () => {
    expect(lineOfFirst('foo', 'foo')).toBe(1);
  });

  it('returns the 1-indexed line number', () => {
    expect(lineOfFirst('a\nb\nc', 'c')).toBe(3);
  });

  it('returns undefined when not found', () => {
    expect(lineOfFirst('a\nb', 'z')).toBeUndefined();
  });
});
