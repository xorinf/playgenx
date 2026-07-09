import { useState } from 'react';
import { OpenAIProvider, generatePlayground, type ArtifactError, type ArtifactResult } from 'playgenx';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const DEFAULT_CONTEXT = `Binary search finds an item in a sorted array in O(log n) time by repeatedly dividing the search interval in half.`;

export function App() {
  const [concept, setConcept] = useState('binary search');
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<ArtifactResult | null>(null);

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  async function onGenerate() {
    if (!apiKey) return;
    setStatus('loading');
    setResult(null);
    const r = await generatePlayground(
      { context, concept, kind: 'playground' },
      { provider: new OpenAIProvider({ apiKey }) },
    );
    setResult(r);
    setStatus(r.ok ? 'ok' : 'error');
  }

  return (
    <div className="app">
      <h1>PlayGenX Playground</h1>
      <p className="lede">Generate an interactive playground artifact for a given concept.</p>

      {!apiKey && (
        <div className="warn">
          <strong>VITE_OPENAI_API_KEY is not set.</strong> Copy <code>apps/playground/.env.example</code> to
          <code>apps/playground/.env</code> and add your key, then restart the dev server.
        </div>
      )}

      <div className="row">
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
        <div className="result">
          <header>
            <span>
              <strong>artifact</strong> · {result.artifact.kind} · {result.artifact.providerId} ·{' '}
              {result.artifact.model}
            </span>
            <span>body</span>
          </header>
          <pre>{result.artifact.body}</pre>
          <div className="sandbox-wrap">
            <header>
              <span>sandboxed preview</span>
              <span>allow-scripts only</span>
            </header>
            <Sandbox body={result.artifact.body} />
          </div>
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
  // Render the body inside a sandboxed iframe. We DO NOT eval it as JS — we
  // put the source in a <pre> and also embed it in a basic HTML page.
  const srcDoc = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 16px; }
  pre { background: #f4f4f5; padding: 12px; border-radius: 6px; overflow: auto; }
</style></head>
<body>
  <h3>Generated body (not executed in v0.1.0)</h3>
  <pre>${escapeHtml(body)}</pre>
</body></html>`;
  return <iframe sandbox="allow-scripts" srcDoc={srcDoc} title="Generated body preview" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
