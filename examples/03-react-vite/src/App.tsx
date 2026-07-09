import { useState } from 'react';
import { generatePlayground, type ArtifactError, type ArtifactResult } from '@playgenx/core';

export function App() {
  const [concept, setConcept] = useState('binary search');
  const [context, setContext] = useState('Lecture on binary search…');
  const [result, setResult] = useState<ArtifactResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onGenerate() {
    setBusy(true);
    setResult(null);
    // In a real app you'd pass an OpenAIProvider with a real key, fetched
    // from a server you control. We keep this example short and pass the
    // env-var key directly.
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY ?? '';
    const { OpenAIProvider } = await import('@playgenx/core');
    const r = await generatePlayground(
      { context, concept, kind: 'playground' },
      { provider: new OpenAIProvider({ apiKey }) },
    );
    setResult(r);
    setBusy(false);
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>PlayGenX · minimal React example</h1>
      <label>
        Concept
        <input value={concept} onChange={(e) => setConcept(e.target.value)} />
      </label>
      <label style={{ display: 'block', marginTop: 12 }}>
        Context
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={4}
          style={{ display: 'block', width: '100%' }}
        />
      </label>
      <button onClick={onGenerate} disabled={busy} style={{ marginTop: 12 }}>
        {busy ? 'Generating…' : 'Generate'}
      </button>
      {result && !result.ok && <ErrorBox error={result.error} />}
      {result && result.ok && (
        <pre style={{ background: '#f4f4f5', padding: 12, marginTop: 16, overflow: 'auto' }}>
          {result.artifact.body}
        </pre>
      )}
    </main>
  );
}

function ErrorBox({ error }: { error: ArtifactError }) {
  return (
    <div style={{ background: '#fee2e2', padding: 12, marginTop: 16, borderRadius: 6 }}>
      <strong>{error.stage} failed</strong>
      <div>{error.message}</div>
    </div>
  );
}
