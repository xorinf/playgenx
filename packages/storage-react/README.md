# `@playgenx/storage-react`

React 19 hooks over an `@playgenx/storage` `ArtifactStorage`. Save, list, re-mount, and delete artifacts from components without managing effects yourself.

## Install

```sh
pnpm add @playgenx/storage-react @playgenx/storage @playgenx/types react@^19
```

React 19 is a peer dependency; this package does not bundle it.

## Use

Wrap your tree in `<StorageProvider>` once, then call the hooks anywhere beneath it:

```tsx
import { LocalAdapter } from '@playgenx/storage';
import {
  StorageProvider,
  useSaveArtifact,
  useListedArtifacts,
  useDeleteArtifact,
} from '@playgenx/storage-react';

function Library() {
  const { artifacts, refresh, loading } = useListedArtifacts();
  const save = useSaveArtifact();
  const remove = useDeleteArtifact();

  return (
    <>
      <button
        onClick={async () => {
          const r = await save({ artifact: {/* ... */} as any });
          if (r.ok) refresh();
        }}
      >
        save
      </button>
      <ul>
        {artifacts.map((a) => (
          <li key={a.id}>
            {a.artifact.kind} · {a.artifact.body.slice(0, 24)}
            <button
              onClick={async () => {
                const r = await remove(a.id);
                if (r.ok) refresh();
              }}
            >
              delete
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function App() {
  return (
    <StorageProvider adapter={new LocalAdapter({ storage: globalThis.localStorage })}>
      <Library />
    </StorageProvider>
  );
}
```

## Hooks

| Hook                                                  | What it returns                                |
| ----------------------------------------------------- | ---------------------------------------------- |
| `useStorage()`                                        | The adapter (throws if no provider is mounted) |
| `useStorageContext()`                                 | The adapter or `null` (safe variant)           |
| `useSaveArtifact(override?)`                          | `(input) => Promise<HookResult<SaveResult>>`   |
| `useListedArtifacts({ kind?, limit?, newestFirst? })` | `{ artifacts, refresh, loading, error }`       |
| `useStoredArtifact(id, override?)`                    | `{ artifact, refresh, loading, error }`        |
| `useDeleteArtifact(override?)`                        | `(id) => Promise<HookResult<boolean>>`         |

The optional `override` parameter lets a single component bound to a non-provider adapter (rarely needed).

## Result shape

Hooks never throw. Errors resolve as `{ ok: false, error: 'message' }`. Successes resolve as `{ ok: true, value }`. Call-sites that want exceptions wrap the call in a try/catch instead.

## Versioning

This package follows PlayGenX's overall version policy (mirror `playgenx` core).

## License

MIT — see [LICENSE](../../LICENSE).
