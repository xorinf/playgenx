/**
 * React context for an {@link ArtifactStorage} adapter.
 *
 * The playground typically has one adapter for the whole tree; a
 * React context is the simplest way to share it without prop-drilling.
 *
 * @packageDocumentation
 */

import * as React from 'react';
import type { ArtifactStorage } from '@playgenx/storage';

const StorageContext = React.createContext<ArtifactStorage | null>(null);
StorageContext.displayName = 'PlayGenX.StorageContext';

export interface StorageProviderProps {
  /** Single adapter to use across the tree. Required. */
  readonly adapter: ArtifactStorage;
  /** Children that consume the storage via hooks. */
  readonly children: React.ReactNode;
}

/**
 * Wraps children with a single artifact-storage adapter. Hooks like
 * {@link useStorage}, {@link useSaveArtifact}, and
 * {@link useListedArtifacts} read this context.
 */
export function StorageProvider({
  adapter,
  children,
}: StorageProviderProps): React.JSX.Element {
  return (
    <StorageContext.Provider value={adapter}>{children}</StorageContext.Provider>
  );
}

export { StorageContext };
