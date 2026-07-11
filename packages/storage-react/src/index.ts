/**
 * @playgenx/storage-react
 *
 * React 19 hooks over an ArtifactStorage adapter.
 *
 * @packageDocumentation
 */

export { StorageProvider, StorageContext, type StorageProviderProps } from './context.js';

export {
  useStorage,
  useStorageContext,
  useSaveArtifact,
  useListedArtifacts,
  useStoredArtifact,
  useDeleteArtifact,
  type HookResult,
} from './hooks.js';

// Re-export the storage contract types consumers will need.
export type {
  ArtifactStorage,
  StoredArtifact,
  SaveInput,
  SaveResult,
  ListQuery,
  ArtifactKind,
} from '@playgenx/types';
