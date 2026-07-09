import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIError, OpenAIProvider } from './openai.js';

const originalFetch = globalThis.fetch;
const originalEnv = process.env.OPENAI_API_KEY;

function mockFetchOnce(body: unknown, init: { status?: number; ok?: boolean } = {}): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValueOnce({
    ok: init.ok ?? (init.status === undefined || (init.status >= 200 && init.status < 300)),
    status: init.status ?? 200,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
  } as unknown as Response);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEnv === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalEnv;
  }
  vi.restoreAllMocks();
});

describe('OpenAIProvider', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-env';
  });

  it('returns content from a successful response', async () => {
    mockFetchOnce({ choices: [{ message: { content: 'hello there' } }] });
    const provider = new OpenAIProvider();
    const result = await provider.complete('hi');
    expect(result).toBe('hello there');
  });

  it('throws OpenAIError with status on 401', async () => {
    mockFetchOnce({ error: { message: 'bad key' } }, { status: 401 });
    const provider = new OpenAIProvider();
    await expect(provider.complete('hi')).rejects.toMatchObject({
      name: 'OpenAIError',
      status: 401,
    });
  });

  it('throws OpenAIError with status on 429', async () => {
    mockFetchOnce('rate limited', { status: 429 });
    const provider = new OpenAIProvider();
    await expect(provider.complete('hi')).rejects.toMatchObject({
      name: 'OpenAIError',
      status: 429,
    });
  });

  it('throws OpenAIError on 5xx', async () => {
    mockFetchOnce('boom', { status: 500 });
    const provider = new OpenAIProvider();
    await expect(provider.complete('hi')).rejects.toMatchObject({
      name: 'OpenAIError',
      status: 500,
    });
  });

  it('throws when API key is missing from both env and constructor', async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAIProvider();
    await expect(provider.complete('hi')).rejects.toThrow(/API key missing/);
  });

  it('throws when the response shape is missing choices', async () => {
    mockFetchOnce({ unexpected: true });
    const provider = new OpenAIProvider();
    await expect(provider.complete('hi')).rejects.toThrow(/missing choices/);
  });

  it('uses constructor apiKey over env', async () => {
    const fn = mockFetchOnce({ choices: [{ message: { content: 'ok' } }] });
    const provider = new OpenAIProvider({ apiKey: 'sk-constructor' });
    await provider.complete('hi');
    const [, init] = fn.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-constructor');
  });

  it('honors model override in options', async () => {
    const fn = mockFetchOnce({ choices: [{ message: { content: 'ok' } }] });
    const provider = new OpenAIProvider();
    await provider.complete('hi', { model: 'gpt-4o' });
    const [, init] = fn.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('gpt-4o');
  });

  it('honors defaultModel override in constructor', async () => {
    const fn = mockFetchOnce({ choices: [{ message: { content: 'ok' } }] });
    const provider = new OpenAIProvider({ defaultModel: 'gpt-4-turbo' });
    await provider.complete('hi');
    const [, init] = fn.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('gpt-4-turbo');
  });

  it('sends the correct request body shape', async () => {
    const fn = mockFetchOnce({ choices: [{ message: { content: 'ok' } }] });
    const provider = new OpenAIProvider();
    await provider.complete('explain binary search');
    const [url, init] = fn.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'explain binary search' }],
      temperature: 0.7,
    });
  });

  it('honors custom baseUrl', async () => {
    const fn = mockFetchOnce({ choices: [{ message: { content: 'ok' } }] });
    const provider = new OpenAIProvider({ baseUrl: 'https://proxy.example.com' });
    await provider.complete('hi');
    const [url] = fn.mock.calls[0]!;
    expect(url).toBe('https://proxy.example.com/v1/chat/completions');
  });

  it('wraps network errors in OpenAIError with cause', async () => {
    const networkErr = new TypeError('fetch failed');
    const fn = vi.fn().mockRejectedValueOnce(networkErr);
    globalThis.fetch = fn as unknown as typeof fetch;
    const provider = new OpenAIProvider();
    try {
      await provider.complete('hi');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenAIError);
      expect((err as OpenAIError).cause).toBe(networkErr);
    }
  });
});
