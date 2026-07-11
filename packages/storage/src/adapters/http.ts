/**
 * HTTP-backed adapter for PlayGenX artifacts.
 *
 * Treats the endpoint as opaque: POST/GET/PATCH/DELETE against
 * `${baseUrl}${pathPrefix}/${id}` (default path prefix `/api/artifacts`).
 *
 * The server side is the caller's responsibility. The adapter does
 * not interpret status codes beyond 2xx/4xx/5xx and never throws on
 * a missing record; it resolves to `null` instead.
 *
 * To plug in:
 *   - A Cloudflare Worker fronting KV
 *   - A Vercel / Express route
 *   - A Firebase Functions endpoint
 *   - Any REST API in between
 *
 * The adapter is intentionally implementation-light; it does the
 * fetch + JSON plumbing and lets the server enforce real auth,
 * schema, and quota concerns.
 */

import type {
  ArtifactStorage,
  ListQuery,
  SaveInput,
  SaveResult,
  StoredArtifact,
} from '@playgenx/types';

export interface HttpAdapterOptions {
  /** Base URL the adapter POSTs to. Required. */
  readonly baseUrl: string;
  /** Path prefix; default is `/api/artifacts`. No trailing slash. */
  readonly pathPrefix?: string;
  /** Per-call headers. Common use: `Authorization: Bearer ...`. */
  readonly headers?: Record<string, string>;
  /** Optional fetch implementation override (for tests / SSR / Bun). */
  readonly fetchImpl?: typeof fetch;
  /** Optional per-call timeout via `AbortSignal`. */
  readonly timeoutMs?: number;
}

const DEFAULT_PATH_PREFIX = '/api/artifacts';

interface IndexEntry {
  id: string;
  createdAt: number;
}

interface ListResponse {
  items: StoredArtifact[];
}

interface GetResponse {
  item: StoredArtifact;
}

interface SaveResponse {
  id: string;
  url?: string;
}

export class HttpAdapter implements ArtifactStorage {
  readonly id = 'http';

  private readonly baseUrl: string;
  private readonly pathPrefix: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number | undefined;

  constructor(options: HttpAdapterOptions) {
    if (!options.baseUrl) throw new Error('HttpAdapter: baseUrl is required');
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.pathPrefix = (options.pathPrefix ?? DEFAULT_PATH_PREFIX).replace(/\/+$/, '');
    this.headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs;
  }

  private url(id?: string): string {
    return id
      ? `${this.baseUrl}${this.pathPrefix}/${encodeURIComponent(id)}`
      : `${this.baseUrl}${this.pathPrefix}`;
  }

  private async withTimeout(signal: AbortSignal | undefined): Promise<AbortController> {
    if (this.timeoutMs == null) {
      return new AbortController(); // never aborted, returned for API symmetry
    }
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(new Error('HttpAdapter timeout')), this.timeoutMs);
    ac.signal.addEventListener('abort', () => clearTimeout(t));
    if (signal) ac.signal.addEventListener('abort', () => ac.abort(signal.reason));
    return ac;
  }

  async save(input: SaveInput): Promise<SaveResult> {
    const body = {
      id: input.id,
      artifact: input.artifact,
    };
    const ac = await this.withTimeout(undefined);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(input.id), {
        method: input.id ? 'PUT' : 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: ac.signal,
      });
    } catch {
      // Network failure — surface as a thrown error so the caller can
      // decide (don't silently swallow).
      throw new Error('HttpAdapter.save: network failure');
    }
    if (res.status === 404 && input.id) {
      // Server says no record under that id yet (REST fallthrough);
      // fall back to POST without the id.
      res = await this.fetchImpl(this.url(), {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: ac.signal,
      });
    }
    if (!res.ok) {
      throw new Error(`HttpAdapter.save: server returned ${res.status}`);
    }
    const parsed = (await res.json()) as SaveResponse;
    return { id: parsed.id, url: parsed.url };
  }

  async get(id: string): Promise<StoredArtifact | null> {
    const ac = await this.withTimeout(undefined);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(id), {
        method: 'GET',
        headers: this.headers,
        signal: ac.signal,
      });
    } catch {
      return null;
    }
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const parsed = (await parsedJson(res)) as GetResponse | null;
    if (!parsed?.item) return null;
    return parsed.item;
  }

  async list(query: ListQuery = {}): Promise<readonly StoredArtifact[]> {
    const params = new URLSearchParams();
    if (query.kind) params.set('kind', query.kind);
    if (query.providerId) params.set('providerId', query.providerId);
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.newestFirst != null) params.set('newestFirst', String(query.newestFirst));
    const q = params.toString();
    const url = q ? `${this.url()}?${q}` : this.url();
    const ac = await this.withTimeout(undefined);
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, signal: ac.signal });
    } catch {
      return [];
    }
    if (!res.ok) return [];
    const parsed = (await parsedJson(res)) as ListResponse | null;
    const items = parsed?.items ?? [];
    // Sort newest-first by default on the client too, in case the
    // server didn't honor the parameter.
    return [...items].sort((a, b) => {
      const cmp = b.createdAt - a.createdAt;
      return query.newestFirst === false ? -cmp : cmp;
    });
  }

  async delete(id: string): Promise<boolean> {
    const ac = await this.withTimeout(undefined);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(id), {
        method: 'DELETE',
        headers: this.headers,
        signal: ac.signal,
      });
    } catch {
      return false;
    }
    return res.status === 200 || res.status === 204;
  }
}

async function parsedJson(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

// Re-export the optional internal shape for tests that want to
// exercise the server contract directly.
export type { IndexEntry };
