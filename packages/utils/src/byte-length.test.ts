import { describe, expect, it } from 'vitest';
import { utf8ByteLength } from './byte-length.js';

describe('utf8ByteLength', () => {
  it('counts ASCII as 1 byte per character', () => {
    expect(utf8ByteLength('')).toBe(0);
    expect(utf8ByteLength('a')).toBe(1);
    expect(utf8ByteLength('hello')).toBe(5);
  });

  it('counts 2-byte UTF-8 sequences for Latin-1 supplement', () => {
    // 'é' is U+00E9 — 2 bytes in UTF-8.
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('café')).toBe(5); // c(1) + a(1) + f(1) + é(2)
  });

  it('counts 3-byte UTF-8 sequences for BMP characters', () => {
    // '中' is U+4E2D — 3 bytes in UTF-8.
    expect(utf8ByteLength('中')).toBe(3);
    expect(utf8ByteLength('中文')).toBe(6);
  });

  it('counts 4-byte UTF-8 sequences for supplementary-plane characters', () => {
    // '🎉' is U+1F389 — 4 bytes in UTF-8, but 2 UTF-16 code units (surrogate pair).
    // This is the case where `string.length` would be WRONG (length=2, bytes=4).
    expect(utf8ByteLength('🎉')).toBe(4);
    expect(utf8ByteLength('a🎉b')).toBe(6); // 1 + 4 + 1
  });

  it('agrees with TextEncoder for arbitrary input', () => {
    const samples = [
      '',
      'x',
      'hello world',
      'café au lait',
      '你好世界',
      '🎉🚀💖',
      'mixed: café 中 🎉',
    ];
    const enc = new TextEncoder();
    for (const s of samples) {
      expect(utf8ByteLength(s)).toBe(enc.encode(s).length);
    }
  });
});