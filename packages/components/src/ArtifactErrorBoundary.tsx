/**
 * Error boundary for rendered artifacts. Catches render-time errors
 * (malformed body, throw from a component, etc.) and shows a recoverable
 * fallback. Without this, a single bad artifact blanks the student's
 * whole page.
 *
 * Design notes:
 * - Uses React's class-component error boundary API (the only
 *   first-class option in React 18/19).
 * - Default fallback shows the error message + an optional "Show source"
 *   toggle that reveals the raw body. Consumer can override with
 *   `fallback` for custom UX.
 * - `onError` fires before the fallback renders so consumers can log
 *   to Sentry / Datadog / etc.
 *
 * @packageDocumentation
 */

import * as React from 'react';

import { ShowSource } from './ShowSource.js';

export interface ArtifactErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Called when a render error is caught. The `info.componentStack`
   * string is the React component stack at the point of error. Log
   * to your observability backend here.
   */
  onError?: (error: Error, info: { componentStack: string }) => void;
  /**
   * Optional body string. If present and the consumer renders the
   * default fallback, a "Show source" toggle will be available that
   * reveals this body verbatim. Ignored if a custom `fallback` is
   * supplied (the consumer is responsible for surfacing source).
   */
  body?: string;
  /**
   * Source language hint for the ShowSource toggle in the default
   * fallback. Defaults to 'tsx' (most artifacts are TSX).
   */
  language?: 'tsx' | 'json';
  /**
   * Optional custom fallback. Pass a React element for a static fallback
   * or a function that receives the error for a dynamic one. If
   * omitted, the default fallback renders a panel with the error
   * message and (if `body` is supplied) a ShowSource toggle.
   */
  fallback?: React.ReactNode | ((error: Error) => React.ReactNode);
  /**
   * Label shown in the default fallback header. Defaults to the
   * artifact kind identifier (e.g. "playground artifact failed to
   * render"). The consumer is expected to pass the kind.
   */
  kind?: string;
}

interface State {
  error: Error | null;
}

/**
 * Default fallback panel. Renders the error message and, if `body` is
 * provided, a ShowSource toggle. Designed to be a calm, recoverable
 * surface — not a stack-trace dump that panics users.
 */
function DefaultFallback({
  error,
  body,
  language,
  kind,
}: {
  error: Error;
  body?: string;
  language?: 'tsx' | 'json';
  kind?: string;
}): React.JSX.Element {
  const label = kind ? `${kind} artifact failed to render` : 'Artifact failed to render';
  return (
    <div
      role="alert"
      data-pgx="ArtifactErrorBoundary"
      data-pgx-kind={kind}
      style={{
        border: '1px solid #fca5a5',
        background: '#fef2f2',
        color: '#7f1d1d',
        borderRadius: '8px',
        padding: '12px 16px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: '14px',
        maxWidth: '720px',
        margin: '12px 0',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '6px' }}>{label}</div>
      <code
        data-pgx="error-message"
        style={{
          display: 'block',
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: '12px',
          background: 'rgba(0,0,0,0.04)',
          padding: '6px 8px',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {error.message}
      </code>
      {body !== undefined ? (
        <div style={{ marginTop: '8px' }}>
          <ShowSource body={body} language={language}>
            {(toggle, showing) => (
              <button
                type="button"
                onClick={toggle}
                data-pgx="show-source-toggle"
                style={{
                  background: 'transparent',
                  border: '1px solid #fca5a5',
                  color: '#7f1d1d',
                  padding: '4px 10px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {showing ? 'Hide source' : 'Show source'}
              </button>
            )}
          </ShowSource>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Error boundary. Catches render-time errors in `children` and shows
 * the fallback. The error state is reset on prop change of `children`
 * (or explicit `resetKey` bump) so the consumer can recover by
 * re-rendering.
 */
export class ArtifactErrorBoundary extends React.Component<
  ArtifactErrorBoundaryProps,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (this.props.onError) {
      try {
        this.props.onError(error, { componentStack: info.componentStack ?? '' });
      } catch {
        // Swallow — onError callback errors must not break rendering.
      }
    }
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    const { fallback, body, language, kind } = this.props;
    if (typeof fallback === 'function') return fallback(error);
    if (fallback !== undefined) return fallback;
    return (
      <DefaultFallback
        error={error}
        body={body}
        language={language}
        kind={kind}
      />
    );
  }
}
