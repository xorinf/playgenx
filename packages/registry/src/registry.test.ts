import { describe, expect, it } from 'vitest';
import { BUILT_IN_TAGS, DEFAULT_REGISTRY, createRegistry } from './index.js';

describe('createRegistry', () => {
  it('isAllowed returns true for seeded names', () => {
    const r = createRegistry(['Foo', 'Bar']);
    expect(r.isAllowed('Foo')).toBe(true);
    expect(r.isAllowed('Bar')).toBe(true);
  });

  it('isAllowed returns false for unseeded names', () => {
    const r = createRegistry(['Foo']);
    expect(r.isAllowed('Baz')).toBe(false);
  });

  it('add changes membership', () => {
    const r = createRegistry();
    r.add('Quux');
    expect(r.isAllowed('Quux')).toBe(true);
  });

  it('list returns the seeded names', () => {
    const r = createRegistry(['A', 'B', 'C']);
    expect(r.list().sort()).toEqual(['A', 'B', 'C']);
  });

  it('two registries are independent', () => {
    const a = createRegistry(['X']);
    const b = createRegistry();
    a.add('Y');
    expect(a.isAllowed('Y')).toBe(true);
    expect(b.isAllowed('Y')).toBe(false);
  });

  it('empty seed works', () => {
    const r = createRegistry();
    expect(r.list()).toEqual([]);
  });
});

describe('DEFAULT_REGISTRY', () => {
  it('contains the expected default components', () => {
    for (const name of ['Button', 'TextField', 'Slider', 'Chart', 'Card']) {
      expect(DEFAULT_REGISTRY.isAllowed(name)).toBe(true);
    }
  });
});

describe('BUILT_IN_TAGS', () => {
  it('includes the safe HTML set', () => {
    for (const tag of ['div', 'span', 'p', 'h1', 'button', 'input', 'pre']) {
      expect(BUILT_IN_TAGS).toContain(tag);
    }
  });
});
