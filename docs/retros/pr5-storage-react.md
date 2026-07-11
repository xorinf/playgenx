---
tags: [retro, pr5, storage-react, ui]
pr: 5
commit: ee9add8
---

# PR 5 — storage-react hooks + LibraryPanel

**What:** New package `@playgenx/storage-react`. React 19
hooks over an `ArtifactStorage` adapter (from PR 1):

- `StorageProvider` / `useStorageContext`
- `useSaveArtifact` / `useDeleteArtifact`
- `useListedArtifacts({ kind?, limit?, newestFirst? })`
- `useStoredArtifact(id)`

Plus a `LibraryPanel` component in the playground that lists
saved artifacts and lets the user save the latest generation,
load a stored one back, or delete.

**Hook contract:** None of the hooks throw. Returns
`HookResult<T> = { ok: true, value } | { ok: false, error }`.
Consumers that want exceptions wrap in try/catch.

**Adapter pattern:** The playground creates one
`LocalAdapter` via `useMemo([])` and passes it into a single
`StorageProvider`. Re-renders of `App` driven by keystrokes in
the input fields don't invalidate the provider value reference,
so the library doesn't reload every render.

**Why a side panel:** A list of saved artifacts is a feature
in its own right, not a modal. The panel also shows a "Save
latest" mini-form when a successful artifact exists in the
`result` state.

**Decisions worth remembering:**

- `storage-react` deliberately does _not_ depend on
  `react-dom` — only `react` is a peer. This keeps it usable
  in React Native without DOM, even though the playground
  is web-only.
- The LibraryPanel uses a static `import LocalAdapter` instead
  of `await import(...)` inside the click handler. The dynamic
  import triggered tsdown's "ineffective dynamic import"
  warning when both the App and the panel statically and
  dynamically imported the same module.
- A click on "Load" clears the `result` state and sets a
  `storedOverlay` state with the artifact's metadata. Both
  views can't appear together, simplifying the contract.

**Tests:** 10 (provider mount/unmount, save/list/get/delete
round-trips, error result shapes, kind-filter reactivity, null-
id path). jsdom + RTL.

**Bundle:** storage-react tarball 6.0KB / 1.7KB gzipped. The
playground bundle grew from 211KB / 67KB to 217KB / 68KB.

**Trade-off:** A more reactive library (mutations auto-refresh
the list) would be nicer than the explicit `refresh()` call
we make on each save/delete. Defer until a second adapter is
sitting alongside — premature to abstract without a real
comparison.

**Next:** PR 6 adds the second concrete adapter (S3), giving a
production-quality backend option for real users.
