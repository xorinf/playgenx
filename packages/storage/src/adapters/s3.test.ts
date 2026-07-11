import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { S3Adapter, probeS3Adapter } from './s3.js';
import type { Artifact } from '@playgenx/types';

/**
 * Test S3Adapter against a mocked AWS SDK. We use `createRequire`
 * to install a synthetic `@aws-sdk/client-s3` into Node's module
 * cache before constructing the adapter, which then resolves the
 * SDK to our mock instead of trying to make real AWS calls.
 */

const realRequire = createRequire(import.meta.url);
const modulePath = realRequire.resolve('@aws-sdk/client-s3');

interface MockState {
  objects: Map<string, string>;
  throws: { get?: boolean; delete?: boolean };
}

function installMockSdk0(): { state: MockState; restore: () => void } {
  const state: MockState = { objects: new Map(), throws: {} };

  class S3Client {
    config: { region: string };
    constructor(cfg: { region: string }) {
      this.config = cfg;
    }
    async send(cmd: { name: string; input: Record<string, unknown> }): Promise<unknown> {
      if (cmd.name === 'PutObjectCommand') {
        const { Bucket, Key, Body } = cmd.input as { Bucket: string; Key: string; Body: string };
        state.objects.set(`${Bucket}/${Key}`, Body);
        return {};
      }
      if (cmd.name === 'GetObjectCommand') {
        if (state.throws.get) throw new Error('boom');
        const { Bucket, Key } = cmd.input as { Bucket: string; Key: string };
        const body = state.objects.get(`${Bucket}/${Key}`);
        if (!body) {
          throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
        }
        return { Body: body };
      }
      if (cmd.name === 'DeleteObjectCommand') {
        if (state.throws.delete) throw new Error('boom');
        const { Bucket, Key } = cmd.input as { Bucket: string; Key: string };
        if (!state.objects.has(`${Bucket}/${Key}`)) {
          throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
        }
        state.objects.delete(`${Bucket}/${Key}`);
        return {};
      }
      if (cmd.name === 'ListObjectsV2Command') {
        const { Bucket, Prefix } = cmd.input as { Bucket: string; Prefix?: string };
        const keys: Array<{ Key: string }> = [];
        for (const k of state.objects.keys()) {
          const [b, ...rest] = k.split('/');
          const key = rest.join('/');
          if (b !== Bucket) continue;
          if (Prefix && !key.startsWith(Prefix)) continue;
          keys.push({ Key: key });
        }
        return { Contents: keys };
      }
      throw new Error(`unknown command ${cmd.name}`);
    }
  }

  class PutObjectCommand {
    input: Record<string, unknown>;
    name = 'PutObjectCommand';
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class GetObjectCommand {
    input: Record<string, unknown>;
    name = 'GetObjectCommand';
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class DeleteObjectCommand {
    input: Record<string, unknown>;
    name = 'DeleteObjectCommand';
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class ListObjectsV2Command {
    input: Record<string, unknown>;
    name = 'ListObjectsV2Command';
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  const mock = {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
  };

  // Replace Node's module cache entry. Stash the previous one so we
  // can restore it after the test.
  const previous = require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: mock,
    paths: [],
    children: [],
    // @ts-expect-error minimal CommonJSModule cache shape
    require: realRequire,
    path: modulePath,
    parent: null,
  } as NodeJS.Module;

  return {
    state,
    restore: () => {
      if (previous) require.cache[modulePath] = previous;
      else delete require.cache[modulePath];
    },
  };
}

function makeOptions() {
  return {
    region: 'us-east-1',
    accessKeyId: 'AKIAFAKE',
    secretAccessKey: 'secret',
    bucket: 'test-bucket',
    keyPrefix: 'test/',
  };
}

function aFixture(over: Partial<Artifact> = {}): Artifact {
  return {
    kind: 'playground',
    body: '<div />',
    providerId: 'mock',
    model: 'mock-1',
    ...over,
  };
}

describe('S3Adapter', () => {
  // We don't unit-test the missing-SDK path: the SDK is a dev
  // dependency of this package, so the require always resolves
  // during tests. The friendly error path is exercised in the
  // adapter's source (`loadSdk` try/catch) and is covered by
  // documentation; a runtime smoke test belongs in a separate
  // environment that omits the dependency.

  // Tests that call installMockSdk() should NOT manually call
  // restore() — the afterEach below handles it. The mock SDK
  // install/uninstall is wrapped per-test so a test that throws or
  // returns early still leaves the require.cache clean.
  let pendingRestore: (() => void) | null = null;

  beforeEach(() => {
    pendingRestore = null;
  });
  afterEach(() => {
    if (pendingRestore) {
      try {
        pendingRestore();
      } catch {
        /* ignore */
      }
      pendingRestore = null;
    }
  });

  function installMockSdk(): { state: MockState; restore: () => void } {
    const sdk = installMockSdk0();
    pendingRestore = sdk.restore;
    return sdk;
  }

  it('throws when bucket is missing', () => {
    installMockSdk();
    expect(() =>
      new S3Adapter({
        region: 'us-east-1',
        accessKeyId: 'x',
        secretAccessKey: 'y',
        bucket: '',
      }),
    ).toThrow(/bucket is required/);
  });

  it('throws when credentials are missing', () => {
    installMockSdk();
    expect(() =>
      new S3Adapter({
        region: 'us-east-1',
        accessKeyId: '',
        secretAccessKey: '',
        bucket: 'b',
      }),
    ).toThrow(/accessKeyId and secretAccessKey are required/);
  });

  it('round-trips an artifact through save / get / list / delete', async () => {
    const { state, restore } = installMockSdk();
    try {
      const adapter = new S3Adapter(makeOptions());
      const fixture = aFixture({ body: 'round-trip body' });

      const { id } = await adapter.save({ artifact: fixture });
      expect(id).toBeTruthy();

      // Save once more with the same body — same id, idempotent.
      const { id: id2 } = await adapter.save({ artifact: fixture });
      expect(id2).toBe(id);
      expect(state.objects.size).toBe(1);

      // Get round-trip.
      const got = await adapter.get(id);
      expect(got?.artifact.body).toBe(fixture.body);
      expect(got?.artifact.kind).toBe('playground');
      expect(got?.createdAt).toBeGreaterThan(0);

      // List — newest-first by default.
      const list = await adapter.list();
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(id);

      // Save a different kind for kind filter.
      await adapter.save({ artifact: aFixture({ kind: 'poll', body: '{"q":1}' }) });

      // Filter by kind.
      const onlyPlayground = await adapter.list({ kind: 'playground' });
      expect(onlyPlayground).toHaveLength(1);

      // Delete.
      expect(await adapter.delete(id)).toBe(true);
      expect(await adapter.get(id)).toBeNull();
    } finally {
      restore();
    }
  });

  it('id defaults to a content fingerprint when caller omits it', async () => {
    const { restore } = installMockSdk();
    try {
      const adapter = new S3Adapter(makeOptions());
      const fixture = aFixture({ body: 'fingerprint-target' });
      const { id } = await adapter.save({ artifact: fixture });
      // FNV-1a-32 is hex-encoded. Same input -> same id.
      expect(id).toMatch(/^[0-9a-f]{1,8}$/);
      const got = await adapter.get(id);
      expect(got?.artifact.body).toBe('fingerprint-target');
    } finally {
      restore();
    }
  });

  it('returns null on get when the object is missing', async () => {
    const { restore } = installMockSdk();
    try {
      const adapter = new S3Adapter(makeOptions());
      expect(await adapter.get('does-not-exist')).toBeNull();
    } finally {
      restore();
    }
  });

  it('list respects limit', async () => {
    const { restore } = installMockSdk();
    try {
      const adapter = new S3Adapter(makeOptions());
      for (let i = 0; i < 5; i++) {
        await adapter.save({ artifact: aFixture({ body: `body ${i}` }) });
      }
      const limited = await adapter.list({ limit: 2 });
      expect(limited.length).toBeLessThanOrEqual(2);
    } finally {
      restore();
    }
  });

  it('delete returns false when the object is missing', async () => {
    installMockSdk();
    const adapter = new S3Adapter(makeOptions());
    // Mock throws NoSuchKey for missing objects; adapter swallows + returns false.
    const first = await adapter.delete('nope');
    expect(first).toBe(false);
  });

  it('list decodes URL-encoded ids and strips the prefix', async () => {
    const { state, restore } = installMockSdk();
    try {
      const adapter = new S3Adapter({ ...makeOptions(), keyPrefix: 'custom/' });
      const fixture = aFixture({ body: 'unique-payload-for-decode' });
      const { id } = await adapter.save({ artifact: fixture });
      // Confirm the raw key shape on disk.
      const onDisk = [...state.objects.keys()][0];
      expect(onDisk).toMatch(/^test-bucket\/custom\/.*\.json$/);
      // List should return the entry by decoded id.
      const list = await adapter.list();
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(id);
    } finally {
      restore();
    }
  });
});

describe('probeS3Adapter', () => {
  // No mock needed — the real SDK is installed as a devDependency.
  it('returns sdkVersion when SDK is installed', async () => {
    const r = await probeS3Adapter();
    expect(r.sdkVersion).toMatch(/AWS SDK v3/);
  });
});
