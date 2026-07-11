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
export { S3Adapter, probeS3Adapter } from './adapters/s3.js';
export type { S3AdapterOptions } from './adapters/s3.js';

import { LocalAdapter as LocalAdapterImpl, type LocalAdapterOptions } from './adapters/local.js';
import { HttpAdapter as HttpAdapterImpl, type HttpAdapterOptions } from './adapters/http.js';
import { S3Adapter as S3AdapterImpl, type S3AdapterOptions } from './adapters/s3.js';

/**
 * Factory: select and instantiate an adapter by id. Returns a
 * concrete `ArtifactStorage` whose typing depends on the chosen
 * adapter's options.
 */
export function createStorage(which: 'local', options?: LocalAdapterOptions): LocalAdapterImpl;
export function createStorage(which: 'http', options: HttpAdapterOptions): HttpAdapterImpl;
export function createStorage(which: 's3', options: S3AdapterOptions): S3AdapterImpl;
export function createStorage(
  which: 'local' | 'http' | 's3',
  options?: LocalAdapterOptions | HttpAdapterOptions | S3AdapterOptions,
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
  if (which === 's3') {
    if (!options || !('bucket' in options)) {
      throw new Error('createStorage("s3") requires options.bucket');
    }
    return new S3AdapterImpl(options as S3AdapterOptions);
  }
  throw new Error(`Unknown storage adapter: ${String(which)}`);
}
