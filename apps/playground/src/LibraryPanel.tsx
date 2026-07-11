import { useState, type ReactElement } from 'react';
import {
  useListedArtifacts,
  useStoredArtifact,
  useDeleteArtifact,
  type StoredArtifact,
} from '@playgenx/storage-react';
import { LocalAdapter } from '@playgenx/storage';
import type { Artifact, ArtifactKind } from 'playgenx';

/**
 * Side panel: list saved artifacts, "load" one back into view, delete,
 * or copy the id. Reads from the StorageProvider in App. Stays in its
 * own file so App.tsx can stay narrow.
 */

function formatBody(artifact: Artifact): string {
  if (artifact.kind === 'poll' || artifact.kind === 'quiz' || artifact.kind === 'flashcards') {
    try {
      return JSON.stringify(JSON.parse(artifact.body), null, 2);
    } catch {
      return artifact.body;
    }
  }
  return artifact.body;
}

function shortId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

interface LibraryPanelProps {
  /**
   * Latest artifact produced. When set, the panel exposes a "Save"
   * button that persists this artifact into storage.
   */
  readonly latest: Extract<{ ok: true; artifact: Artifact }, { ok: true }> | null;
  /**
   * Called when the user clicks "Load" on a stored artifact. The
   * host app decides what to do with the loaded body — typically it
   * overlays the playground's result section.
   */
  readonly onLoad: (stored: StoredArtifact) => void;
}

export function LibraryPanel({ latest, onLoad }: LibraryPanelProps): ReactElement {
  const { artifacts, loading, refresh, error } = useListedArtifacts({ limit: 20 });
  const remove = useDeleteArtifact();

  return (
    <aside className="library">
      <header>
        <strong>Library</strong>
        <button type="button" onClick={() => void refresh()}>
          refresh
        </button>
      </header>
      {error ? <div className="error">library error: {error}</div> : null}
      {loading ? <div className="muted">loading…</div> : null}
      <ul>
        {artifacts.length === 0 && !loading ? (
          <li className="muted">No saved artifacts yet.</li>
        ) : null}
        {artifacts.map((a) => (
          <li key={a.id}>
            <div className="row-l">
              <span className="kind">{a.artifact.kind}</span>
              <code title={a.id}>{shortId(a.id)}</code>
            </div>
            <div className="row-l">
              <span className="muted">{a.artifact.providerId}</span>
              <span className="muted">{fmtDate(a.createdAt)}</span>
            </div>
            <div className="row-l actions">
              <button type="button" onClick={() => onLoad(a)} aria-label={`Load ${a.id}`}>
                load
              </button>
              <button
                type="button"
                onClick={async () => {
                  const r = await remove(a.id);
                  if (r.ok) await refresh();
                }}
                aria-label={`Delete ${a.id}`}
              >
                delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {latest ? <LatestSavePanel latest={latest} onSaved={() => void refresh()} /> : null}
    </aside>
  );
}

interface LatestSavePanelProps {
  readonly latest: Extract<{ ok: true; artifact: Artifact }, { ok: true }>;
  readonly onSaved: () => void;
}

function LatestSavePanel({ latest, onSaved }: LatestSavePanelProps): ReactElement {
  const [feedback, setFeedback] = useState<string | null>(null);
  return (
    <div className="latest-save">
      <header>
        <strong>Save latest</strong>
      </header>
      <p className="muted">
        {latest.artifact.kind} · {latest.artifact.providerId} · {latest.artifact.model}
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            if (!globalThis.localStorage) {
              setFeedback('no localStorage available');
              return;
            }
            const local = new LocalAdapter({ storage: globalThis.localStorage });
            await local.save({ artifact: latest.artifact });
            setFeedback('Saved.');
            onSaved();
          } catch (err) {
            setFeedback(err instanceof Error ? err.message : String(err));
          }
        }}
      >
        save to library
      </button>
      {feedback ? <p className="muted">{feedback}</p> : null}
    </div>
  );
}

/**
 * Detail view: render a stored artifact inline using the project's
 * renderer. Re-mounted with the same registry + component map as
 * App.tsx. Used when the user clicks "load" in the library.
 */
function RenderStored({ stored }: { stored: StoredArtifact }): ReactElement {
  return (
    <article className="result">
      <header>
        <span>
          <strong>artifact</strong> · {stored.artifact.kind} · {stored.artifact.providerId} ·{' '}
          {stored.artifact.model}
        </span>
        <span>id {shortId(stored.id)}</span>
      </header>
      <pre>{formatBody(stored.artifact)}</pre>
    </article>
  );
}

/**
 * Hook-shaped wrapper: returns a renderer function suitable for
 * binding to ResultView on demand. Callers wire a stored artifact
 * into the playground's display path.
 */
export function useStoredRender(id: string | null) {
  return useStoredArtifact(id);
}

export { RenderStored };

// Re-export so App.tsx imports from one file.
export type { ArtifactKind };
