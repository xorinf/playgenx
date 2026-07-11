/**
 * Pluggable persistence for PlayGenX artifacts.
 *
 * Re-exports the storage contract from `@playgenx/types` plus a small
 * `createStorage()` factory. Mirrors the `createProvider()` factory
 * convention used by `@playgenx/providers`.
 *
 * Adapters are also reachable via subpaths so callers can tree-shake
 * or instantiate them directly:
 *
 *   import { createStorage } from '@playgenx/storage';
 *   import { LocalAdapter } from '@playgenx/storage/local';
 *
 * @packageDocumentation
 */

export type {
  ArtifactStorage,
  StoredArtifact,
  SaveInput,
  SaveResult,
  ListQuery,
} from '@playgenx/types';

export type { HttpAdapterOptions } from './adapters/http.js';
export { HttpAdapter } from './adapters/http.js';
export { LocalAdapter } from './adapters/local.js';
export type { LocalAdapterOptions } from './adapters/local.js';

import { LocalAdapter as LocalAdapterImpl, type LocalAdapterOptions } from './adapters/local.js';
import { HttpAdapter as HttpAdapterImpl, type HttpAdapterOptions } from './adapters/http.js';

/**
 * Factory: select and instantiate an adapter by id. Returns a
 * concrete `ArtifactStorage` whose typing depends on the chosen
 * adapter's options.
 */
export function createStorage(
  which: 'local',
  options?: LocalAdapterOptions,
): LocalAdapterImpl;
export function createStorage(
  which: 'http',
  options: HttpAdapterOptions,
): HttpAdapterImpl;
export function createStorage(
  which: 'local' | 'http',
  options?: LocalAdapterOptions | HttpAdapterOptions,
): ArtifactStorage {
  if (which === 'local') {
    return new LocalAdapterImpl(options as LocalAdapterOptions | undefined);
  }
  if (which === 'http') {
    if (!options || !('baseUrl' in options)) {
      throw new Error('createStorage("http") requires options.baseUrl');
    }
    return new HttpAdapterImpl(options as HttpAdapterOptions);
  }
  throw new Error(`Unknown storage adapter: ${String(which)}`);
}
