import * as React from 'react';
import { colors, radius } from './theme.js';

export interface CodeProps {
  language?: string;
  children?: React.ReactNode;
}

/**
 * Inline code formatter. Renders children as a `<code>` element inside
 * a styled wrapper. If `children` is a single string, it displays
 * verbatim; for multi-line content we fall back to a `<pre>`-styled
 * block.
 */
export function Code({ language, children }: CodeProps): React.JSX.Element {
  const isString = typeof children === 'string';
  const isMulti = isString && (children as string).includes('\n');
  if (isMulti) {
    return (
      <pre
        data-pgx="Code"
        data-language={language ?? 'text'}
        style={{
          background: colors.codeBg,
          color: colors.codeFg,
          padding: '12px',
          borderRadius: radius.md,
          fontSize: '12px',
          overflow: 'auto',
          margin: 0,
        }}
      >
        <code>{children}</code>
      </pre>
    );
  }
  return (
    <code
      data-pgx="Code-inline"
      data-language={language ?? 'text'}
      style={{
        background: colors.codeBg,
        color: colors.codeFg,
        padding: '2px 6px',
        borderRadius: radius.sm,
        fontSize: '0.9em',
      }}
    >
      {children}
    </code>
  );
}
