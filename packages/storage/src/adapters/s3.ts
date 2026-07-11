/**
 * S3 adapter for PlayGenX artifacts.
 *
 * Persists each StoredArtifact as a JSON-serialized S3 object under
 * a configurable prefix (default `pgx-artifacts/`). The object's
 * key is `${prefix}${id}.json`; the id is caller-supplied or
 * content-derived from the artifact body via the same fnv1a hash
 * used by LocalAdapter.
 *
 * This adapter uses AWS SDK v3. The dependency is OPTIONAL — it is
 * only imported when an adapter instance is actually constructed,
 * so consumers using only LocalAdapter or HttpAdapter don't pull
 * the AWS SDK into their bundle.
 *
 * Prereqs (peerDependenciesMeta.optional):
 *   - @aws-sdk/client-s3 (^3.0.0)
 *
 * @packageDocumentation
 */

import { createRequire } from 'node:module';
import type {
  ArtifactStorage,
  ListQuery,
  SaveInput,
  SaveResult,
  StoredArtifact,
} from '@playgenx/types';

/**
 * Subset of the AWS SDK we use. We type this against a thin surface
 * so consumers without the SDK installed still compile (the import
 * itself is dynamic and wrapped in try/catch).
 */
interface AwsClientLike {
  send(command: AwsCommandLike): Promise<{
    Body?: ReadableStreamLike | string | Uint8Array;
    Contents?: S3ObjectSummary[];
  }>;
}

interface AwsCommandLike {
  readonly input: Record<string, unknown>;
  readonly name: string;
}

interface AwsCommandCtorLike {
  readonly name: string;
  new (input: Record<string, unknown>): AwsCommandLike;
}

interface ReadableStreamLike {
  transformToString(): Promise<string>;
}

interface S3ObjectSummary {
  Key?: string;
  Size?: number;
  LastModified?: Date;
}

interface ClientConfigLike {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  endpoint?: string;
}

interface ClientModuleLike {
  S3Client: new (config: ClientConfigLike) => AwsClientLike;
  PutObjectCommand: AwsCommandCtorLike;
  GetObjectCommand: AwsCommandCtorLike;
  DeleteObjectCommand: AwsCommandCtorLike;
  ListObjectsV2Command: AwsCommandCtorLike;
}

/**
 * Lazy CJS bridge. AWS SDK v3 ships CJS as well as ESM; we use the
 * CJS entry so the import is synchronous and the adapter's
 * constructor can fail fast if the SDK isn't installed. The
 * require is cached so repeated adapter construction is free.
 */
const sdkRequire = createRequire(import.meta.url);
function loadSdk(): ClientModuleLike {
  try {
    return sdkRequire('@aws-sdk/client-s3') as unknown as ClientModuleLike;
  } catch (err) {
    throw new Error(
      'S3Adapter: @aws-sdk/client-s3 is not installed. Run `pnpm add @aws-sdk/client-s3` to use the S3 adapter.',
      { cause: err },
    );
  }
}

export interface S3AdapterOptions {
  /** S3 region. Required. */
  readonly region: string;
  /** AWS access key id. Required. */
  readonly accessKeyId: string;
  /** AWS secret access key. Required. */
  readonly secretAccessKey: string;
  /** Bucket name. Required. */
  readonly bucket: string;
  /** Custom endpoint (e.g. for R2, MinIO, LocalStack). Optional. */
  readonly endpoint?: string;
  /** Key prefix. Defaults to `pgx-artifacts/`. */
  readonly keyPrefix?: string;
  /**
   * Hard cap on listed results. Defaults to 1000.
   * Matches LocalAdapter's semantics so callers can swap adapters
   * without re-tuning.
   */
  readonly maxKeys?: number;
}

const DEFAULT_PREFIX = 'pgx-artifacts/';
const DEFAULT_MAX_KEYS = 1000;

/**
 * FNV-1a-32 hash — same derivation as LocalAdapter so the same
 * body+kind+providerId produces the same id regardless of which
 * backend is in play. The two adapters stay interchangeable for
 * callers that key by content fingerprint.
 */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function defaultId(artifact: { body: string; providerId: string; kind: string }): string {
  const seed = `${artifact.kind}::${artifact.providerId}::${artifact.body}`;
  return fnv1a32(seed).toString(16);
}

/**
 * Body shape persisted to S3. Wrapping the StoredArtifact in an
 * envelope gives us versioning room without changing the contract
 * on `StoredArtifact`.
 */
interface S3ObjectEnvelope {
  readonly version: 1;
  readonly stored: StoredArtifact;
}

export class S3Adapter implements ArtifactStorage {
  readonly id = 's3';

  private readonly bucket: string;
  private readonly prefix: string;
  private readonly maxKeys: number;
  private readonly sdk: ClientModuleLike;
  private readonly client: AwsClientLike;

  constructor(options: S3AdapterOptions) {
    if (!options.bucket) throw new Error('S3Adapter: bucket is required');
    if (!options.region) throw new Error('S3Adapter: region is required');
    if (!options.accessKeyId || !options.secretAccessKey) {
      throw new Error('S3Adapter: accessKeyId and secretAccessKey are required');
    }
    this.bucket = options.bucket;
    this.prefix = options.keyPrefix ?? DEFAULT_PREFIX;
    this.maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;

    // Load SDK synchronously — fails fast on a missing dep at
    // construction time, instead of surprising the caller on the
    // first `save()`.
    this.sdk = loadSdk();
    const cfg: ClientConfigLike = {
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    };
    if (options.endpoint) cfg.endpoint = options.endpoint;
    this.client = new this.sdk.S3Client(cfg);
  }

  private objectKey(id: string): string {
    return `${this.prefix}${id}.json`;
  }

  async save(input: SaveInput): Promise<SaveResult> {
    const id = input.id ?? defaultId(input.artifact);
    const createdAt = Date.now();
    const record: StoredArtifact = {
      id,
      createdAt,
      artifact: input.artifact,
    };
    const envelope: S3ObjectEnvelope = { version: 1, stored: record };
    await this.client.send(
      new this.sdk.PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(id),
        Body: JSON.stringify(envelope),
        ContentType: 'application/json',
      }) as AwsCommandLike,
    );
    return { id };
  }

  async get(id: string): Promise<StoredArtifact | null> {
    const body = await this.fetchBody(id);
    if (!body) return null;
    let text: string;
    if (typeof body === 'string') text = body;
    else if (body instanceof Uint8Array) text = new TextDecoder().decode(body);
    else text = await body.transformToString();
    let envelope: S3ObjectEnvelope;
    try {
      envelope = JSON.parse(text) as S3ObjectEnvelope;
    } catch {
      return null;
    }
    if (!envelope?.stored) return null;
    return envelope.stored;
  }

  private async fetchBody(id: string): Promise<string | Uint8Array | ReadableStreamLike | null> {
    try {
      const resp = await this.client.send(
        new this.sdk.GetObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(id),
        }) as AwsCommandLike,
      );
      return resp?.Body ?? null;
    } catch {
      return null;
    }
  }

  async list(query: ListQuery = {}): Promise<readonly StoredArtifact[]> {
    const limit = typeof query.limit === 'number' ? query.limit : this.maxKeys;
    const out: StoredArtifact[] = [];
    const resp = await this.client.send(
      new this.sdk.ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
        MaxKeys: limit,
      }) as AwsCommandLike,
    );
    const items = resp.Contents ?? [];
    for (const item of items) {
      if (!item.Key) continue;
      if (item.Key.endsWith('/')) continue;
      // Strip prefix + `.json` suffix, decode any URL encoding.
      const stem = item.Key.slice(this.prefix.length).replace(/\.json$/, '');
      const decoded = decodeURIComponent(stem);
      const stored = await this.get(decoded);
      if (!stored) continue;
      if (query.kind && stored.artifact.kind !== query.kind) continue;
      if (query.providerId && stored.artifact.providerId !== query.providerId) continue;
      out.push(stored);
      if (out.length >= limit) break;
    }
    if (query.newestFirst === false) {
      return [...out].reverse();
    }
    return out;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.send(
        new this.sdk.DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(id),
        }) as AwsCommandLike,
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Helpful for callers who want to verify the S3 adapter will load
 * without instantiating it. Returns the inferred AWS SDK shape on
 * success, throws with a clear error if not installed.
 */
export async function probeS3Adapter(): Promise<{ readonly sdkVersion: string }> {
  loadSdk();
  return { sdkVersion: 'AWS SDK v3 (client-s3)' };
}