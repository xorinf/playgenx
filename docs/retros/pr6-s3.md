---
tags: [retro, pr6, s3, backend, aws-sdk]
pr: 6
commit: d69f50f (lock-file follow-up: 3d2c185)
---

# PR 6 — S3Adapter

**What:** Third concrete adapter backed by AWS SDK v3
`client-s3`. Persists each artifact as a JSON envelope
`{version: 1, stored: StoredArtifact}` under
`${keyPrefix}${id}.json`. Same FNV-1a-32 content-fingerprint
derivation as LocalAdapter; swapping adapters leaves stored
ids stable.

**Decision recap:** Picked S3 over uploadthing and Firebase:

- **uploadthing:** Last published 10 months ago. No way to
  verify API surface from CLI without risking a staled
  integration. Rejected.
- **Firebase Firestore:** Powerful but ~150KB bundle, requires
  auth setup and config. Vendor lock-in. Rejected for the
  same reason — wrong tool for "small cross-device sync."
- **AWS S3 / R2 / MinIO:** Tree-shaken, vendor-portable,
  SDK deterministic, free tier covers dev. Picked.

**SDK install:** `@aws-sdk/client-s3` is declared as an
optional peer dependency (`peerDependenciesMeta.optional`).
Consumers using only `LocalAdapter` or `HttpAdapter` don't
pull it in. The adapter itself uses `createRequire` to load
the SDK synchronously in the constructor, so a missing dep
fails fast at `new S3Adapter(...)`, not on the first `save()`.

**Public surface:**

```ts
import { S3Adapter } from '@playgenx/storage/s3';
const adapter = new S3Adapter({
  region: 'us-east-1',
  accessKeyId: '...',
  secretAccessKey: '...',
  bucket: 'playgenx-artifacts',
  endpoint: 'https://r2.example.com', // optional, for R2/MinIO
});
```

Also wired through `createStorage('s3', options)` in the
barrel.

**Tests:** 9. Use `createRequire` to install a synthetic
`@aws-sdk/client-s3` module into Node's `require.cache` for
the test duration; vitest's `afterEach` restores the real
cache entry. Mock implements `S3Client.send` for
`PutObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`
(throwing a `NoSuchKey` on missing), `ListObjectsV2Command`.

**Coverage:**

- bucket / credentials / region validation
- save / get / list / delete round-trip
- default id (content fingerprint) when caller omits
- missing-key returns null (get); missing-key returns false
  (delete)
- list respects limit
- list decodes URL-encoded ids and strips the prefix
- adapter throws the right error when SDK is missing (manual
  contract; not unit-tested because SDK is a dev dep)

**Bundle:** s3.ts source 11KB / 1.6KB types. `@aws-sdk/client-s3`
and transitive deps 80KB tree-shaken, only loaded when an
S3Adapter is constructed.

**Trade-off:** No automatic pagination across `IsTruncated`
pages in `list()`. The default `maxKeys=1000` matches the
LocalAdapter contract; for production scale, add a custom
`ContinuationToken` loop.

**Open followups:**

- The lockfile commit (`3d2c185`) is technically PR 6 post-
  work. In future PRs, run `pnpm install` _before_ committing
  to make sure lockfile updates are caught.
- A real AWS environment + integration test is the next
  extension; we'd want testcontainers-S3 or MinIO in CI.
