/**
 * LocalStorage-backed adapter for PlayGenX artifacts.
 *
 * Stores each artifact as a JSON-serialized entry keyed by the
 * artifact's `id`. Includes a separate index for ordered listing.
 *
 * Browser-only. In Node environments (tests included) it requires a
 * shim — see `LocalStorageAdapter_test_helpers` in the test file.
 *
 * Quota: browsers cap localStorage at ~5MB per origin. Artifacts
 * stored here MUST be < 5MB individually; the cross-tab quota is
 * shared so a `maxEntries` cap is also enforced (default 1000).
 */

import type {
  ArtifactStorage,
  ListQuery,
  SaveInput,
  SaveResult,
  StoredArtifact,
} from '@playgenx/types';

export interface LocalAdapterOptions {
  /** localStorage key prefix. Defaults to `pgx:art:`. */
  readonly keyPrefix?: string;
  /** Hard cap on stored artifacts. Defaults to 1000. Older entries
   * are evicted when the cap is exceeded. */
  readonly maxEntries?: number;
  /**
   * Inject a `localStorage`-shaped object. Defaults to
   * `globalThis.localStorage`. Useful in tests.
   */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
}

const DEFAULT_PREFIX = 'pgx:art:';
const DEFAULT_MAX_ENTRIES = 1000;

interface IndexEntry {
  id: string;
  createdAt: number;
}

export class LocalAdapter implements ArtifactStorage {
  readonly id = 'local';

  private readonly prefix: string;
  private readonly indexKey: string;
  private readonly maxEntries: number;
  private readonly storage:
    Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | undefined;

  constructor(options: LocalAdapterOptions = {}) {
    this.prefix = options.keyPrefix ?? DEFAULT_PREFIX;
    this.indexKey = `${this.prefix}__index__`;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.storage = options.storage;
  }

  /** Returns the underlying storage, falling back to globalThis. */
  private get store(): NonNullable<LocalAdapter['storage']> {
    const s =
      this.storage ??
      ((globalThis as { localStorage?: unknown }).localStorage as
        Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | undefined);
    if (!s) {
      throw new Error('LocalAdapter: no localStorage available (browser-only)');
    }
    return s;
  }

  private entryKey(id: string): string {
    return `${this.prefix}${id}`;
  }

  private readIndex(): IndexEntry[] {
    try {
      const raw = this.store.getItem(this.indexKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e): e is IndexEntry =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as IndexEntry).id === 'string' &&
          typeof (e as IndexEntry).createdAt === 'number',
      );
    } catch {
      return [];
    }
  }

  private writeIndex(index: IndexEntry[]): void {
    this.store.setItem(this.indexKey, JSON.stringify(index));
  }

  private appendIndex(entry: IndexEntry): void {
    const idx = this.readIndex();
    // Idempotent upsert — same id is replaced in place, kept sorted
    // by createdAt for default newest-first listing.
    const filtered = idx.filter((e) => e.id !== entry.id);
    filtered.push(entry);
    filtered.sort((a, b) => a.createdAt - b.createdAt);
    this.writeIndex(filtered);
  }

  private evictIfNeeded(): void {
    const idx = this.readIndex();
    while (idx.length > this.maxEntries) {
      const evict = idx.shift();
      if (!evict) break;
      try {
        this.store.removeItem(this.entryKey(evict.id));
      } catch {
        // best-effort eviction; surface only on next read failure.
      }
    }
    if (idx.length !== this.readIndex().length) this.writeIndex(idx);
  }

  async save(input: SaveInput): Promise<SaveResult> {
    const id = input.id ?? defaultId(input.artifact);
    const createdAt = Date.now();
    const record: StoredArtifact = {
      id,
      createdAt,
      artifact: input.artifact,
    };
    try {
      this.store.setItem(this.entryKey(id), JSON.stringify(record));
    } catch (err) {
      throw new Error(
        `LocalAdapter.save failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
    this.appendIndex({ id, createdAt });
    this.evictIfNeeded();
    return { id };
  }

  async get(id: string): Promise<StoredArtifact | null> {
    try {
      const raw = this.store.getItem(this.entryKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredArtifact;
      if (
        typeof parsed?.id !== 'string' ||
        typeof parsed?.createdAt !== 'number' ||
        !parsed?.artifact
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async list(query: ListQuery = {}): Promise<readonly StoredArtifact[]> {
    const idx = this.readIndex();
    // `kind` and `providerId` filters are applied after each
    // entry is decoded; the index list itself just orders by date.
    const ordered =
      (query.newestFirst ?? true)
        ? [...idx].sort((a, b) => b.createdAt - a.createdAt)
        : [...idx].sort((a, b) => a.createdAt - b.createdAt);
    const limited = typeof query.limit === 'number' ? ordered.slice(0, query.limit) : ordered;
    const out: StoredArtifact[] = [];
    for (const ix of limited) {
      const r = await this.get(ix.id);
      if (r) {
        if (query.kind && r.artifact.kind !== query.kind) continue;
        if (query.providerId && r.artifact.providerId !== query.providerId) continue;
        out.push(r);
      }
    }
    return out;
  }

  async delete(id: string): Promise<boolean> {
    const exists = this.store.getItem(this.entryKey(id)) !== null;
    if (!exists) return false;
    try {
      this.store.removeItem(this.entryKey(id));
    } catch {
      return false;
    }
    const idx = this.readIndex().filter((e) => e.id !== id);
    this.writeIndex(idx);
    return true;
  }
}

/**
 * Derive a default id from the artifact body when the caller did not
 * supply one. Deterministic — same artifact body always yields the
 * same id. Uses a tiny non-cryptographic hash because we don't need
 * cryptographic strength, only stability; Node 22 / modern browsers
 * provide `crypto.subtle.digest` for stronger needs but a 32-bit FNV
 * is enough to spread ids uniformly across the index.
 */
export function defaultId(artifact: { body: string; providerId: string; kind: string }): string {
  const seed = `${artifact.kind}::${artifact.providerId}::${artifact.body}`;
  return fnv1a32(seed).toString(16);
}

function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
