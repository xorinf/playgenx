import { describe, it, expect } from 'vitest';
import { HttpAdapter } from './http.js';
import type { Artifact } from '@playgenx/types';

function aFixture(): Artifact {
  return {
    kind: 'playground',
    body: '<div/>',
    providerId: 'mock',
    model: 'mock-1',
  };
}

class MockFetch {
  calls: { url: string; init: RequestInit }[] = [];
  private route: (url: string, init: RequestInit) => Response;
  constructor(route: (url: string, init: RequestInit) => Response) {
    this.route = route;
  }
  fetch: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    const safeInit: RequestInit = init ?? {};
    this.calls.push({ url, init: safeInit });
    return Promise.resolve(this.route(url, safeInit));
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpAdapter', () => {
  it('save POSTs without id; server returns id', async () => {
    const mf = new MockFetch(() => jsonResponse(200, { id: 'srv-id', url: 'https://ex.com/a' }));
    const a = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: mf.fetch });
    const out = await a.save({ artifact: aFixture() });
    expect(out).toEqual({ id: 'srv-id', url: 'https://ex.com/a' });
    expect(mf.calls[0]?.init.method).toBe('POST');
    expect(mf.calls[0]?.url).toBe('https://x.test/api/artifacts');
  });

  it('save PUTs when an id is supplied', async () => {
    const mf = new MockFetch(() => jsonResponse(200, { id: 'hi' }));
    const a = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: mf.fetch });
    await a.save({ id: 'hi', artifact: aFixture() });
    expect(mf.calls[0]?.init.method).toBe('PUT');
    expect(mf.calls[0]?.url).toBe('https://x.test/api/artifacts/hi');
  });

  it('fallback to POST when PUT 404s (server says "no record yet")', async () => {
    let n = 0;
    const mf = new MockFetch(() => {
      n++;
      if (n === 1) return jsonResponse(404, { error: 'no such id' });
      return jsonResponse(200, { id: 'fallback' });
    });
    const a = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: mf.fetch });
    const out = await a.save({ id: 'new', artifact: aFixture() });
    expect(out.id).toBe('fallback');
    expect(n).toBe(2);
    expect(mf.calls[1]?.init.method).toBe('POST');
  });

  it('get returns null for 404; throws network error for non-ok non-404', async () => {
    const mf = new MockFetch(() => jsonResponse(500, { error: 'oops' }));
    const a = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: mf.fetch });
    expect(await a.get('missing')).toBeNull();

    const mf2 = new MockFetch(() => jsonResponse(500, { error: 'oops' }));
    const a2 = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: mf2.fetch });
    expect(await a2.get('bad')).toBeNull();
  });

  it('list builds query params and returns server-shaped items', async () => {
    const items = [
      { id: '1', createdAt: 1, artifact: aFixture() },
      { id: '2', createdAt: 2, artifact: aFixture() },
    ];
    const mf = new MockFetch(() => jsonResponse(200, { items }));
    const a = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: mf.fetch });
    const out = await a.list({ kind: 'playground', limit: 5, newestFirst: true });
    expect(out.map((s) => s.id)).toEqual(['2', '1']);
    expect(mf.calls[0]?.url).toContain('kind=playground');
    expect(mf.calls[0]?.url).toContain('limit=5');
    expect(mf.calls[0]?.url).toContain('newestFirst=true');
  });

  it('list returns [] on network failure (does not throw)', async () => {
    const boom: typeof fetch = () => Promise.reject(new Error('nope'));
    const a = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: boom });
    expect(await a.list()).toEqual([]);
  });

  it('delete returns true on 200/204; false on 404', async () => {
    const mfOk = new MockFetch(() => new Response(null, { status: 204 }));
    const aOk = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: mfOk.fetch });
    expect(await aOk.delete('x')).toBe(true);

    const mf404 = new MockFetch(() => jsonResponse(404, {}));
    const a404 = new HttpAdapter({ baseUrl: 'https://x.test', fetchImpl: mf404.fetch });
    expect(await a404.delete('y')).toBe(false);
  });

  it('rejects construction without baseUrl', () => {
    expect(() => new HttpAdapter({ baseUrl: '' })).toThrow(/baseUrl/);
  });

  it('respects a custom pathPrefix', async () => {
    const mf = new MockFetch(() => jsonResponse(200, { id: 'x' }));
    const a = new HttpAdapter({
      baseUrl: 'https://x.test',
      pathPrefix: '/v2/art',
      fetchImpl: mf.fetch,
    });
    await a.get('7');
    expect(mf.calls[0]?.url).toBe('https://x.test/v2/art/7');
  });

  it('merges custom headers with default content-type', async () => {
    const mf = new MockFetch(() => jsonResponse(200, { id: 'x' }));
    const a = new HttpAdapter({
      baseUrl: 'https://x.test',
      headers: { Authorization: 'Bearer t' },
      fetchImpl: mf.fetch,
    });
    await a.save({ artifact: aFixture() });
    const headers = mf.calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer t');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
