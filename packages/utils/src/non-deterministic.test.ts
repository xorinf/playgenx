import { describe, expect, it } from 'vitest';
import { stripCodeComments } from './strip-comments.js';
import { findNonDeterministic } from './non-deterministic.js';

/**
 * Helper: mirror the validator's preprocessing so the assertions
 * exercise real input shapes — `stripCodeComments` is what the
 * validator feeds to `findNonDeterministic`.
 */
function check(body: string): string | null {
  return findNonDeterministic(stripCodeComments(body));
}

describe('findNonDeterministic', () => {
  it('returns null on a clean body', () => {
    expect(check('<Container><Heading label="Hello" /></Container>')).toBeNull();
  });

  it('flags Math.random() in a JSX expression', () => {
    expect(check('<Button label={Math.random()} />')).toBe('Math');
  });

  it('flags bare Date.now()', () => {
    expect(check('<Text>{Date.now()}</Text>')).toBe('Date');
  });

  it('flags window. usage (member access)', () => {
    expect(check('<div onClick={() => window.alert(1)} />')).toBe('window');
  });

  it('flags globalThis as a bare identifier', () => {
    expect(check('{globalThis.something}')).toBe('globalThis');
  });

  it('flags process.env access', () => {
    expect(check('{process.env.NODE_ENV}')).toBe('process');
  });

  it('flags self as a bare identifier', () => {
    expect(check('{self.foo}')).toBe('self');
  });

  it('flags crypto.randomUUID', () => {
    expect(check('{crypto.randomUUID()}')).toBe('crypto');
  });

  it('does NOT match keywords that share prefixes (e.g., `match`, `matchedAt`)', () => {
    expect(check('<Text value={matches} />')).toBeNull();
    expect(check('<Text value={updatedAt} />')).toBeNull();
    expect(check('<Text>Self-driving cars</Text>')).toBeNull();
  });

  it('does NOT match forbidden tokens inside a JS string literal', () => {
    expect(check(`<Text label="Math is fun" />`)).toBeNull();
    expect(check(`<Text label="process.env" />`)).toBeNull();
  });

  it('does NOT match forbidden tokens inside a JS line comment', () => {
    expect(check(`
      // We used Math.random() but it should be flagged-then-stripped.
      <div />
    `)).toBeNull();
  });

  it('does NOT match forbidden tokens inside a JS block comment', () => {
    expect(check(`
      /*
       * Note to self: never use Date.now() in a render.
       */
      <div />
    `)).toBeNull();
  });

  it('flags forbidden tokens after a JS comment block ends', () => {
    expect(check(`
      /*
       * OK above.
       */
      <div onClick={() => Math.random()} />
    `)).toBe('Math');
  });

  it('flags a forbidden token even when it occurs twice', () => {
    // First occurrence wins (ordering matches FORBIDDEN list).
    expect(
      check('<div onClick={() => { Date.now(); window.alert(1); }} />'),
    ).toBe('Date');
  });

  it('returns null on an empty body', () => {
    expect(check('')).toBeNull();
  });

  it('flags forbidden tokens when used as a JSX attribute value', () => {
    expect(check(`<div data-x={window.innerWidth} />`)).toBe('window');
  });
});
