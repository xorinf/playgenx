/**
 * Render-prop component that shows a toggle-able raw-source panel.
 * Consumer controls the trigger UI via a children render prop.
 *
 * Design notes:
 * - Render-prop pattern (not props.children-as-trigger) because the
 *   trigger UI varies wildly across consumers (button, link, icon,
 *   inline text). The consumer gets `(toggle, showing)` and decides
 *   what to render.
 * - The source panel is a `<pre>` with `<code>` inside. Plain-text;
 *   no syntax highlighting (avoiding a 50KB highlight.js dep).
 *   Consumers who need highlighting can compose with their own
 *   syntax-highlighter.
 * - The panel is rendered INLINE (not in a portal/tooltip) so the
 *   toggle's visual feedback is immediate.
 *
 * @packageDocumentation
 */

import * as React from 'react';

export interface ShowSourceProps {
  /** The raw body to display when the user expands the source. */
  body: string;
  /** Source language hint. Used in `data-language` for styling hooks. */
  language?: 'tsx' | 'json';
  /**
   * Children is a render prop that receives `(toggle, showing)`.
   * The consumer is expected to render a trigger element (button,
   * link, etc.) and call `toggle` on user interaction.
   */
  children: (toggle: () => void, showing: boolean) => React.ReactNode;
}

/**
 * Toggle button + expandable source panel. The trigger UI is the
 * consumer's choice; the panel is plain `<pre><code>`.
 */
export function ShowSource(props: ShowSourceProps): React.JSX.Element {
  const { body, language, children } = props;
  const [showing, setShowing] = React.useState(false);
  // Wrap setShowing to keep the toggle reference stable. Consumers
  // can pass `toggle` to a `useEffect` dep array without retriggering.
  const toggle = React.useCallback(() => {
    setShowing((s) => !s);
  }, []);

  return (
    <>
      {children(toggle, showing)}
      {showing ? (
        <pre
          data-pgx="ShowSource"
          data-language={language ?? 'text'}
          style={{
            background: '#0f172a',
            color: '#e2e8f0',
            padding: '12px',
            borderRadius: '6px',
            overflowX: 'auto',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '12px',
            lineHeight: 1.5,
            margin: '8px 0 0',
            maxHeight: '320px',
            whiteSpace: 'pre',
          }}
        >
          <code>{body}</code>
        </pre>
      ) : null}
    </>
  );
}
