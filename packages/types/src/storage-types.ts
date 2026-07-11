/**
 * Persistence surface for PlayGenX artifacts.
 *
 * This file defines the *contract* a storage backend must implement.
 * Concrete adapters (localStorage, IndexedDB, HTTP, Firebase, etc.) live
 * in `@playgenx/storage` and import these types. Mirrors the
 * `Provider`-style convention used by the LLM layer.
 *
 * Adapters are *not* expected to validate the artifact schema — they
 * treat the body as opaque payload. Validation stays in
 * `@playgenx/validators`. The only invariant enforced here is shape:
 * `StoredArtifact` is `Artifact` + bookkeeping fields.
 *
 * @packageDocumentation
 */

import type { Artifact } from './index.js';

/**
 * An artifact plus the bookkeeping a storage layer needs to retrieve
 * and re-identify it.
 *
 * `id` is treated as opaque and adapter-defined. Most adapters will use
 * a content fingerprint (sha-256 of the body, or of the fingerprint
 * added in PR 2). `createdAt` is unix-ms at the moment the storage
 * layer first saw the artifact. `sourceRequest` is optional and lets
 * callers re-drive the generation if they want to.
 */
export interface StoredArtifact {
  /** Opaque, adapter-defined identifier. Stable across reloads. */
  readonly id: string;
  /** Unix-ms timestamp at the moment the artifact was first persisted. */
  readonly createdAt: number;
  /** The artifact itself. */
  readonly artifact: Artifact;
}

/**
 * Optional inputs that produced the artifact, kept for the cache-hit
 * path described in PR 2 (and any future "regenerate similar" UX). The
 * adapter does not interpret this; it is just bytes-in-bytes-out.
 */
export interface SaveInput {
  readonly artifact: Artifact;
  /**
   * Caller-chosen id. If omitted, the adapter derives one (e.g. from
   * a content hash). Two calls with the same `id` must be idempotent:
   * the second call *updates* the existing record rather than creating
   * a duplicate.
   */
  readonly id?: string;
  /**
   * If supplied, returned alongside the persisted id by `save`. Most
   * adapters will leave this undefined; only adapters with a public
   * permalink concept (Firebase, S3, uploadthing) populate it.
   */
  readonly sourceRequest?: unknown;
}

/**
 * The result of `save()`. `id` is always set (either caller-provided
 * or adapter-derived). `url` is set *only* if the backend has a public
 * permalink concept.
 */
export interface SaveResult {
  readonly id: string;
  readonly url?: string;
}

/**
 * Filter shape for `list()`. All fields are optional; undefined means
 * "do not filter on this dimension."
 */
export interface ListQuery {
  /** Filter by artifact kind (exact match). */
  readonly kind?: Artifact['kind'];
  /** Provider that produced the artifact (exact match). */
  readonly providerId?: string;
  /** Most-recent first. Default: true. */
  readonly newestFirst?: boolean;
  /** Hard cap on returned rows. Default: 100. Adapters may clamp this. */
  readonly limit?: number;
}

/**
 * Pluggable persistence contract. Mirrors `Provider` in shape — one
 * stable identifier, a small number of methods, no surprises.
 *
 * Implementations:
 *  - `LocalAdapter` — browser localStorage (no deps).
 *  - `IndexedDBAdapter` — PR 5 work; not in this PR.
 *  - `HttpAdapter` — POST/GET against a user-supplied endpoint.
 *  - cloud-hosted adapters — gated on a `phase 6` decision.
 *
 * Adapters MUST be safe to use from a browser context. They MUST NOT
 * throw on transient I/O failures; instead they resolve a falsy or
 * `null` result and let the caller decide what to do.
 */
export interface ArtifactStorage {
  /** Stable identifier for this adapter (e.g. 'local', 'http', 'firebase'). */
  readonly id: string;

  /**
   * Persist an artifact. If `input.id` is provided and already exists,
   * the existing record is overwritten (idempotent upsert). If omitted,
   * the adapter derives an id. Returns the chosen id and, if the
   * backend has a permalink, a URL.
   */
  save(input: SaveInput): Promise<SaveResult>;

  /**
   * Retrieve an artifact by id. Resolves to `null` if absent or if
   * the underlying I/O failed (no exceptions for missing records).
   */
  get(id: string): Promise<StoredArtifact | null>;

  /**
   * List artifacts matching the query. Result order is adapter-defined
   * unless `query.newestFirst` is set; adapters default to
   * newest-first because that is what the playground UI expects.
   */
  list(query?: ListQuery): Promise<readonly StoredArtifact[]>;

  /**
   * Delete an artifact. Resolves to a boolean indicating whether
   * anything was removed. Never throws on missing records.
   */
  delete(id: string): Promise<boolean>;
}
