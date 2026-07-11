/**
 * React hooks for {@link ArtifactStorage}.
 *
 * Each hook returns a stable bound function that closes over the
 * adapter. Errors are reported back as a returned `{ ok: false, error }`
 * so call-sites can decide whether to surface or ignore them; the
 * hooks never throw.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import type { ArtifactKind } from '@playgenx/types';
import type { ArtifactStorage, SaveInput, SaveResult, StoredArtifact } from '@playgenx/storage';
import { StorageContext } from './context.js';

/** Discriminated result wrapper used by all hooks. */
export type HookResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Hook returns the bound adapter from a {@link StorageProvider} — or
 * `null` if no provider is mounted. Use this when you want explicit
 * control over which adapter is in play (e.g. when the playground
 * is on the boundary between SSR and CSR).
 */
export function useStorageContext(): ArtifactStorage | null {
  return React.useContext(StorageContext);
}

/**
 * Hook that returns the underlying adapter or throws a friendly error.
 * Used as the base for the other hooks so they have a stable internal
 * contract.
 */
export function useStorage(): ArtifactStorage {
  const ctx = React.useContext(StorageContext);
  if (!ctx) {
    throw new Error(
      'useStorage(): no <StorageProvider> mounted, and no adapter was passed explicitly. ' +
        'Wrap your tree in <StorageProvider adapter={...}>, or use useStorageWith(adapter).',
    );
  }
  return ctx;
}

/**
 * Save an artifact. Returns the persisted id (and permalink URL when
 * the backend supplies one). Stable across renders: same input =>
 * same callback identity.
 */
export function useSaveArtifact(
  override?: ArtifactStorage,
): (input: SaveInput) => Promise<HookResult<SaveResult>> {
  const ctx = React.useContext(StorageContext);
  const adapter = override ?? ctx;
  return React.useCallback(
    async (input: SaveInput): Promise<HookResult<SaveResult>> => {
      if (!adapter) {
        return {
          ok: false,
          error: 'useSaveArtifact(): no <StorageProvider> mounted and no override adapter supplied',
        };
      }
      try {
        const r = await adapter.save(input);
        return { ok: true, value: r };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [adapter],
  );
}

/**
 * List artifacts and optionally refresh. Returns the loaded list plus
 * a `refresh` callback.
 *
 * The query changes whenever the consumer calls `refresh()` or the
 * `kind` filter changes. If `kind` is undefined, the list is not
 * filtered.
 */
export function useListedArtifacts(
  options: {
    readonly kind?: ArtifactKind;
    readonly limit?: number;
    readonly newestFirst?: boolean;
    /** Override the adapter (rarely needed; provider scope is the norm). */
    readonly adapter?: ArtifactStorage;
  } = {},
): {
  readonly artifacts: readonly StoredArtifact[];
  readonly refresh: () => Promise<void>;
  readonly loading: boolean;
  readonly error: string | null;
} {
  const { kind, limit, newestFirst = true, adapter: override } = options;
  const ctx = React.useContext(StorageContext);
  const adapter = override ?? ctx;

  const [artifacts, setArtifacts] = React.useState<readonly StoredArtifact[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!adapter) {
      setError('useListedArtifacts(): no adapter available');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await adapter.list({ kind, limit, newestFirst });
      setArtifacts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [adapter, kind, limit, newestFirst]);

  React.useEffect(() => {
    void refresh();
    // Refresh whenever the adapter or filter changes.
  }, [refresh]);

  return { artifacts, refresh, loading, error };
}

/**
 * Get a single artifact by id. Returns the loaded record plus a
 * `refresh` callback. Useful when navigating to a specific id.
 */
export function useStoredArtifact(
  id: string | null,
  adapter?: ArtifactStorage,
): {
  readonly artifact: StoredArtifact | null;
  readonly refresh: () => Promise<void>;
  readonly loading: boolean;
  readonly error: string | null;
} {
  const ctx = React.useContext(StorageContext);
  const backing = adapter ?? ctx;

  const [artifact, setArtifact] = React.useState<StoredArtifact | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!id || !backing) {
      setArtifact(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const a = await backing.get(id);
      setArtifact(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id, backing]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { artifact, refresh, loading, error };
}

/**
 * Hook returning a delete callback. Stable across renders.
 */
export function useDeleteArtifact(
  override?: ArtifactStorage,
): (id: string) => Promise<HookResult<boolean>> {
  const ctx = React.useContext(StorageContext);
  const adapter = override ?? ctx;
  return React.useCallback(
    async (id: string): Promise<HookResult<boolean>> => {
      if (!adapter) {
        return { ok: false, error: 'useDeleteArtifact(): no adapter available' };
      }
      try {
        const removed = await adapter.delete(id);
        return { ok: true, value: removed };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    [adapter],
  );
}
