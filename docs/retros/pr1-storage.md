---
tags: [retro, pr1, storage]
pr: 1
commit: 8c9dafc
---

# PR 1 — ArtifactStorage + Local + Http adapters

**What:** Defined the `ArtifactStorage` contract in
`@playgenx/types`; implemented `LocalAdapter` (browser
`localStorage`) and `HttpAdapter` (opaque REST endpoint) in
`@playgenx/storage`.

**Why first:** Persistence was the only feature the user named
twice across the session ("stored somewhere so people can use it
again"). Starting with the contract meant every later PR could
depend on a stable shape.

**Contract shape:**

```ts
interface ArtifactStorage {
  readonly id: string;
  save(input: SaveInput): Promise<SaveResult>;
  get(id: string): Promise<StoredArtifact | null>;
  list(query?: ListQuery): Promise<readonly StoredArtifact[]>;
  delete(id: string): Promise<boolean>;
}
```

`StoredArtifact` is `Artifact + { id, createdAt }`. The `id` is
caller-supplied or content-derived via FNV-1a-32.

**Why a contract instead of just code:** Mirrors the
`@playgenx/providers` `Provider` convention. Same shape,
different domain. Lets callers swap backends without touching
the SDK pipeline.

**Decisions worth remembering:**

- `localStorage` max-entries eviction is FIFO at the index level,
  not LRU. Documented in code.
- HTTP adapter has *no* schema assumptions — POST/GET/PATCH/
  DELETE against `${baseUrl}${pathPrefix}/${id}`. Server owns
  auth + shape.
- Failures resolve as `null` / `[]` / `false` rather than
  throwing. Callers that need richer error detail can re-throw
  from their `try { ... } catch`.
- 21 vitest cases (11 local + 10 http).

**Bundle:** local.ts 4KB / http.ts 3.6KB gzipped.

**Next:** PR 2 builds determinism fields on top of this contract.
