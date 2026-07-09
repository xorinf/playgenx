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
  });
});
