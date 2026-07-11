# `@playgenx/storage`

Pluggable persistence for PlayGenX artifacts. Mirrors the `Provider`-style convention used by `@playgenx/providers`: one stable contract, multiple backends.

## Why

`@playgenx/types` defines `Artifact`; this package defines _where they live_. The contract lives in `@playgenx/types` (`ArtifactStorage`), the implementations live here.

## Install

```sh
pnpm add @playgenx/storage @playgenx/types
```

## Use

```ts
import { createStorage } from '@playgenx/storage';

// Browser, zero deps.
const local = createStorage('local', { maxEntries: 500 });
await local.save({ artifact });
const items = await local.list({ kind: 'playground', limit: 25 });

// Or your own REST endpoint.
import { HttpAdapter } from '@playgenx/storage/http';
const http = new HttpAdapter({ baseUrl: 'https://api.example.com' });
```

## Adapters

| Adapter | Path                                                    | Backend                                              | Notes                                                        |
| ------- | ------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `local` | `@playgenx/storage/local` (or `createStorage('local')`) | browser `localStorage`                               | Default. No deps. ~5MB quota.                                |
| `http`  | `@playgenx/storage/http` (or `createStorage('http')`)   | Any REST API                                         | Opaque URL shape. Server owns schema + auth.                 |
| `s3`    | `@playgenx/storage/s3` (or `createStorage('s3')`)       | AWS S3 (or any S3-compatible: R2, MinIO, LocalStack) | Brings `@aws-sdk/client-s3` (peerDependenciesMeta.optional). |

## Contract

The contract is `ArtifactStorage` (re-exported). Adapters:

- MUST be safe to use in browser contexts.
- MUST NOT throw on transient I/O failures (resolve to `null`/`false`/`[]`).
- MUST treat `input.id` as an idempotent key for `save()` — same `id` updates in place.
- SHOULD derive an id from the artifact body when none is supplied. `local` uses FNV-1a-32; `http` defers to the server.

## Versioning

`@playgenx/storage` follows PlayGenX's overall version policy (mirror `playgenx` core). Breaking changes to `ArtifactStorage` land with a major bump and a migration note.

## License

MIT — see [LICENSE](../../LICENSE).
