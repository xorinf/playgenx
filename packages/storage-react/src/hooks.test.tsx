import { describe, expect, it, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';

import {
  StorageProvider,
  useStorage,
  useSaveArtifact,
  useListedArtifacts,
  useStoredArtifact,
  useDeleteArtifact,
  useStorageContext,
} from './index.js';
import { LocalAdapter } from '@playgenx/storage';
import type { ArtifactStorage } from '@playgenx/storage';
import type { Artifact } from '@playgenx/types';

afterEach(() => cleanup());
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom harness issues */
  }
});

function makeStorage(over?: Partial<{ maxEntries: number; keyPrefix: string }>) {
  return new LocalAdapter({
    storage: globalThis.localStorage,
    ...over,
  });
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

function Probe({ children }: { children?: React.ReactNode }) {
  // Probe that reads context — used to assert adapter wiring.
  const ctx = useStorageContext();
  return (
    <div>
      <span data-testid="ctx-present">{ctx === null ? 'null' : 'ok'}</span>
      {children}
    </div>
  );
}

describe('StorageProvider', () => {
  it('mounts an adapter into context', () => {
    render(
      <StorageProvider adapter={makeStorage()}>
        <Probe />
      </StorageProvider>,
    );
    expect(screen.getByTestId('ctx-present').textContent).toBe('ok');
  });

  it('useStorage throws when no provider is mounted', () => {
    const Probe2 = () => {
      const adapter = useStorage();
      return <span>{adapter.id}</span>;
    };
    expect(() => render(<Probe2 />)).toThrow(/no <StorageProvider> mounted/);
  });
});

describe('useSaveArtifact', () => {
  it('persists an artifact and returns its id', async () => {
    const captured: { id?: string } = {};
    const Comp = () => {
      const save = useSaveArtifact();
      return (
        <button
          type="button"
          onClick={async () => {
            const r = await save({ artifact: aFixture() });
            if (r.ok) captured.id = r.value.id;
            else throw new Error(r.error);
          }}
        >
          save
        </button>
      );
    };
    render(
      <StorageProvider adapter={makeStorage()}>
        <Comp />
      </StorageProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(captured.id).toBeTruthy();
  });

  it('returns an error result when no adapter is available', async () => {
    let result: { ok: boolean; error?: string } | undefined;
    const Comp = () => {
      const save = useSaveArtifact(); // no provider mounted
      return (
        <button
          type="button"
          onClick={async () => {
            result = await save({ artifact: aFixture() });
          }}
        >
          go
        </button>
      );
    };
    render(<Comp />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/no <StorageProvider> mounted/);
  });
});

describe('useListedArtifacts', () => {
  it('loads the initial list on mount', async () => {
    const storage = makeStorage();
    // Pre-seed.
    await storage.save({ artifact: aFixture({ body: 'a' }) });
    await storage.save({ artifact: aFixture({ body: 'b' }) });
    await storage.save({ artifact: aFixture({ body: 'c', kind: 'poll' as const }) });

    const Comp = () => {
      const { artifacts, loading, error } = useListedArtifacts();
      return (
        <>
          <span data-testid="count">{artifacts.length}</span>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="error">{String(error)}</span>
        </>
      );
    };
    render(
      <StorageProvider adapter={storage}>
        <Comp />
      </StorageProvider>,
    );

    // Initial render: loading=true, artifacts empty.
    expect(screen.getByTestId('loading').textContent).toBe('true');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('count').textContent).toBe('3');
    expect(screen.getByTestId('error').textContent).toBe('null');
  });

  it('refilters when the kind prop changes', async () => {
    const storage = makeStorage();
    await storage.save({ artifact: aFixture({ kind: 'playground' }) });
    await storage.save({ artifact: aFixture({ kind: 'poll' }) });

    const Comp = ({ kindFilter }: { kindFilter?: 'playground' | 'poll' }) => {
      const { artifacts } = useListedArtifacts({ kind: kindFilter });
      return <span data-testid="count">{artifacts.length}</span>;
    };
    const Wrapper = () => {
      const [k, setK] = React.useState<'playground' | 'poll' | undefined>(undefined);
      return (
        <>
          <button type="button" onClick={() => setK('playground')}>
            filter playground
          </button>
          <Comp kindFilter={k} />
        </>
      );
    };
    render(
      <StorageProvider adapter={storage}>
        <Wrapper />
      </StorageProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('returns an error message when the adapter throws', async () => {
    const boom: ArtifactStorage = {
      id: 'boom',
      async save() {
        throw new Error('nope');
      },
      async get() {
        return null;
      },
      async list() {
        throw new Error('boom!');
      },
      async delete() {
        return false;
      },
    };
    const Comp = () => {
      const { error, loading } = useListedArtifacts();
      return (
        <>
          <span data-testid="error">{String(error)}</span>
          <span data-testid="loading">{String(loading)}</span>
        </>
      );
    };
    render(
      <StorageProvider adapter={boom}>
        <Comp />
      </StorageProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('boom!'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });
});

describe('useStoredArtifact', () => {
  it('loads an artifact by id', async () => {
    const storage = makeStorage();
    const { id } = await storage.save({ artifact: aFixture({ body: 'specific' }) });
    const Comp = () => {
      const { artifact, loading } = useStoredArtifact(id);
      return (
        <>
          <span data-testid="body">{artifact?.artifact.body ?? 'null'}</span>
          <span data-testid="loading">{String(loading)}</span>
        </>
      );
    };
    render(
      <StorageProvider adapter={storage}>
        <Comp />
      </StorageProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('body').textContent).toBe('specific'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('returns null when id is null', async () => {
    const Comp = () => {
      const { artifact } = useStoredArtifact(null);
      return <span data-testid="body">{artifact ? 'present' : 'absent'}</span>;
    };
    render(
      <StorageProvider adapter={makeStorage()}>
        <Comp />
      </StorageProvider>,
    );
    expect(screen.getByTestId('body').textContent).toBe('absent');
  });
});

describe('useDeleteArtifact', () => {
  it('deletes and reports success', async () => {
    const storage = makeStorage();
    const { id } = await storage.save({ artifact: aFixture() });
    let resolved: boolean | undefined;
    const Comp = () => {
      const remove = useDeleteArtifact();
      return (
        <button
          type="button"
          onClick={async () => {
            const r = await remove(id);
            if (r.ok) resolved = r.value;
          }}
        >
          delete
        </button>
      );
    };
    render(
      <StorageProvider adapter={storage}>
        <Comp />
      </StorageProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(resolved).toBe(true);
  });
});
