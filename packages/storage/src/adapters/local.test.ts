import { describe, it, expect, beforeEach } from 'vitest';
import { LocalAdapter, defaultId } from './local.js';
import type { Artifact } from '@playgenx/types';

/**
 * In-memory store with the slice of the Storage interface the
 * adapter touches. Keeps tests Node-only, no jsdom shim needed.
 */
function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(k: string) {
      return map.has(k) ? (map.get(k) as string) : null;
    },
    key(i: number) {
      return [...map.keys()][i] ?? null;
    },
    removeItem(k: string) {
      map.delete(k);
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
  };
}

function aFixture(over: Partial<Artifact> = {}): Artifact {
  return {
    kind: 'playground',
    body: '<div><Button label="Go" /></div>',
    providerId: 'mock',
    model: 'mock-1',
    ...over,
  };
}

describe('LocalAdapter', () => {
  let store: Storage;
  let adapter: LocalAdapter;

  beforeEach(() => {
    store = makeMemoryStorage();
    adapter = new LocalAdapter({ storage: store, keyPrefix: 'test:' });
  });

  it('round-trips an artifact with a caller-provided id', async () => {
    const fixture = aFixture();
    const { id } = await adapter.save({ id: 'hello', artifact: fixture });
    expect(id).toBe('hello');
    const got = await adapter.get('hello');
    expect(got).not.toBeNull();
    expect(got?.artifact.body).toBe(fixture.body);
    expect(got?.createdAt).toBeGreaterThan(0);
  });

  it('derives a stable id when none is supplied (same body → same id)', async () => {
    const fixture = aFixture();
    const a = await adapter.save({ artifact: fixture });
    const b = await adapter.save({ artifact: { ...fixture, model: 'mock-2' } });
    // Same body+kind+providerId → same id (model is intentionally
    // excluded from defaultId, so the second call should overwrite
    // the first).
    expect(a.id).toBe(b.id);
  });

  it('upserts in place when the same id is supplied twice', async () => {
    await adapter.save({ id: 'x', artifact: aFixture({ body: 'v1' }) });
    await adapter.save({ id: 'x', artifact: aFixture({ body: 'v2' }) });
    const got = await adapter.get('x');
    expect(got?.artifact.body).toBe('v2');
  });

  it('list returns newest-first by default', async () => {
    await adapter.save({ id: 'old', artifact: aFixture({ body: 'old' }) });
    // Tick the clock so createdAt differs.
    await new Promise((r) => setTimeout(r, 5));
    await adapter.save({ id: 'new', artifact: aFixture({ body: 'new' }) });
    const items = await adapter.list();
    expect(items.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('list filters by kind', async () => {
    await adapter.save({ id: 'pg', artifact: aFixture({ kind: 'playground' }) });
    await adapter.save({ id: 'pl', artifact: aFixture({ kind: 'poll', body: '{"question":"x","options":[]}' }) });
    const onlyPlayground = await adapter.list({ kind: 'playground' });
    expect(onlyPlayground).toHaveLength(1);
    expect(onlyPlayground[0]?.id).toBe('pg');
  });

  it('delete removes both the entry and the index reference', async () => {
    await adapter.save({ id: 'gone', artifact: aFixture() });
    expect(await adapter.delete('gone')).toBe(true);
    expect(await adapter.get('gone')).toBeNull();
    // Deleting again is a no-op, returns false.
    expect(await adapter.delete('gone')).toBe(false);
  });

  it('evicts oldest beyond maxEntries', async () => {
    const a = new LocalAdapter({ storage: store, keyPrefix: 'cap:', maxEntries: 2 });
    await a.save({ id: 'a', artifact: aFixture() });
    await new Promise((r) => setTimeout(r, 5));
    await a.save({ id: 'b', artifact: aFixture() });
    await new Promise((r) => setTimeout(r, 5));
    await a.save({ id: 'c', artifact: aFixture() });
    const items = await a.list();
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual(['c', 'b']);
    expect(await a.get('a')).toBeNull();
  });

  it('returns null for malformed stored entries without throwing', async () => {
    store.setItem('test:broken', '{not json');
    expect(await adapter.get('broken')).toBeNull();
  });

  it('id is identical across two LocalAdapter instances reading the same store', async () => {
    const a = new LocalAdapter({ storage: store, keyPrefix: 'shared:' });
    const b = new LocalAdapter({ storage: store, keyPrefix: 'shared:' });
    await a.save({ id: 'shared', artifact: aFixture() });
    const got = await b.get('shared');
    expect(got?.artifact.body).toBe(aFixture().body);
  });

  it('defaultId matches the fnv1a derivation for known inputs', () => {
    expect(
      defaultId({ kind: 'playground', providerId: 'mock', body: '<div/>' }),
    ).toMatchInlineSnapshot(`"17f4c710"`);
    // Snapshot value intentionally lazy-bound — captured once. If
    // the hash function ever changes by design, this snapshot
    // updates and the PR describes why.
  });

  it('defaultId changes when body changes', () => {
    const a = defaultId({ kind: 'playground', providerId: 'mock', body: '<a/>' });
    const b = defaultId({ kind: 'playground', providerId: 'mock', body: '<b/>' });
    expect(a).not.toBe(b);
  });
});
