import { useMemo, useState } from 'react';
import {
  OpenAIProvider,
  generateFlashcards,
  generateLab,
  generatePlayground,
  generatePoll,
  generateQuiz,
  generateSimulation,
  type ArtifactError,
  type ArtifactKind,
  type ArtifactResult,
} from 'playgenx';
import { renderBody } from '@playgenx/renderer';
import { componentMap } from '@playgenx/components';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const KINDS: ReadonlyArray<{ value: ArtifactKind; label: string }> = [
  { value: 'playground', label: 'Playground (interactive TSX)' },
  { value: 'poll', label: 'Poll (single multiple-choice)' },
  { value: 'quiz', label: 'Quiz (multi-question)' },
  { value: 'simulation', label: 'Simulation (interactive with state)' },
  { value: 'flashcards', label: 'Flashcards (study deck)' },
  { value: 'lab', label: 'Lab (guided multi-step)' },
];

const JSON_KINDS: ReadonlySet<ArtifactKind> = new Set(['poll', 'quiz', 'flashcards']);
const TSX_KINDS: ReadonlySet<ArtifactKind> = new Set([
  'playground',
  'simulation',
  'lab',
]);

const DEFAULT_CONTEXT = `Binary search finds an item in a sorted array in O(log n) time by repeatedly dividing the search interval in half.`;

export function App() {
  const [concept, setConcept] = useState('binary search');
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [kind, setKind] = useState<ArtifactKind>('playground');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<ArtifactResult | null>(null);

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  async function onGenerate() {
    if (!apiKey) return;
    setStatus('loading');
    setResult(null);
    const provider = new OpenAIProvider({ apiKey });
    const options = { provider };
    let r: ArtifactResult;
    switch (kind) {
      case 'playground':
        r = await generatePlayground({ context, concept, kind }, options);
        break;
      case 'poll':
        r = await generatePoll({ context, concept, kind }, options);
        break;
      case 'quiz':
        r = await generateQuiz({ context, concept, kind }, options);
        break;
      case 'simulation':
        r = await generateSimulation({ context, concept, kind }, options);
        break;
      case 'flashcards':
        r = await generateFlashcards({ context, concept, kind }, options);
        break;
      case 'lab':
        r = await generateLab({ context, concept, kind }, options);
        break;
    }
    setResult(r);
    setStatus(r.ok ? 'ok' : 'error');
  }

  return (
    <div className="app">
      <h1>PlayGenX Playground</h1>
      <p className="lede">
        Generate an interactive educational artifact for a given concept.
      </p>

      {!apiKey && (
        <div className="warn">
          <strong>VITE_OPENAI_API_KEY is not set.</strong> Copy{' '}
          <code>apps/playground/.env.example</code> to{' '}
          <code>apps/playground/.env</code> and add your key, then restart the
          dev server.
        </div>
      )}

      <div className="row">
        <div>
          <label htmlFor="kind">Kind</label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ArtifactKind)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="concept">Concept</label>
          <input
            id="concept"
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g. binary search"
          />
        </div>
      </div>

      <div>
        <label htmlFor="context">Lecture context</label>
        <textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={onGenerate} disabled={status === 'loading' || !apiKey}>
          {status === 'loading' ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {result && !result.ok && <ErrorBox error={result.error} />}

      {result && result.ok && (
        <ResultView result={result} kind={kind} />
      )}
    </div>
  );
}

function ResultView({
  result,
  kind,
}: {
  result: Extract<ArtifactResult, { ok: true }>;
  kind: ArtifactKind;
}) {
  // Pretty-print JSON for the JSON-bodied kinds.
  const displayBody = useMemo(() => {
    if (JSON_KINDS.has(kind)) {
      try {
        return JSON.stringify(JSON.parse(result.artifact.body), null, 2);
      } catch {
        return result.artifact.body;
      }
    }
    return result.artifact.body;
  }, [result.artifact.body, kind]);

  return (
    <div className="result">
      <header>
        <span>
          <strong>artifact</strong> · {result.artifact.kind} ·{' '}
          {result.artifact.providerId} · {result.artifact.model}
        </span>
        <span>
          {JSON_KINDS.has(kind) ? 'json (pretty)' : 'body'}
        </span>
      </header>
      <pre>{displayBody}</pre>
      {TSX_KINDS.has(kind) && (
        <div className="sandbox-wrap">
          <header>
            <span>sandboxed preview</span>
            <span>allow-scripts only</span>
          </header>
          <Sandbox body={result.artifact.body} />
        </div>
      )}
    </div>
  );
}

function ErrorBox({ error }: { error: ArtifactError }) {
  return (
    <div className="error">
      <strong>
        {error.stage} failed{error.providerId ? ` (${error.providerId})` : ''}
        {error.line ? ` · line ${error.line}` : ''}
      </strong>
      {error.message}
    </div>
  );
}

function Sandbox({ body }: { body: string }) {
  // Render the body through @playgenx/renderer against the default
  // componentMap from @playgenx/components. Try the render; if any
  // component throws (e.g. because a runtime prop value is `undefined`),
  // fall back to the safe source-only preview so the user still sees
  // *something*.
  try {
    return (
      <div
        data-pgx-preview="live"
        style={{
          border: '1px dashed #cbd5e1',
          borderRadius: '6px',
          padding: '12px',
          background: '#ffffff',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          color: '#0f172a',
        }}
      >
        {renderBody(body, componentMap)}
      </div>
    );
  } catch {
    const srcDoc = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 16px; }
  pre { background: #f4f4f5; padding: 12px; border-radius: 6px; overflow: auto; }
</style></head>
<body>
  <h3>Generated body (renderer threw, showing source)</h3>
  <pre>${escapeHtml(body)}</pre>
</body></html>`;
    return <iframe sandbox="allow-scripts" srcDoc={srcDoc} title="Generated body preview" />;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}