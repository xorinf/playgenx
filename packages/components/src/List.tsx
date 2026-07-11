import * as React from 'react';
import { colors } from './theme.js';

export interface ListProps {
  /**
   * Items to render. Schema marks this as `node`; in practice callers
   * pass arrays of strings/numbers/ReactNodes. Anything else is
   * rendered as a single bullet containing the value.
   */
  items?: unknown;
  /** When true, renders as `<ol>` instead of `<ul>`. */
  ordered?: boolean;
  /** Override the wrapper element for full control. */
  children?: React.ReactNode;
}

/**
 * List of items. Renders `items` as a list of strings/numbers (the
 * common artifact prompt output). If `children` are passed they take
 * precedence over `items`.
 */
export function List({ items, ordered, children }: ListProps): React.JSX.Element {
  const style: React.CSSProperties = {
    margin: 0,
    paddingLeft: '20px',
    fontFamily: 'inherit',
    color: colors.fg,
    fontSize: '14px',
    lineHeight: 1.6,
  };
  if (children !== undefined && children !== null) {
    return React.createElement(ordered ? 'ol' : 'ul', { style, 'data-pgx': 'List' }, children);
  }
  const arr = Array.isArray(items) ? items : items === undefined ? [] : [items];
  return React.createElement(
    ordered ? 'ol' : 'ul',
    { style, 'data-pgx': 'List' },
    arr.map((item, i) => {
      const node: React.ReactNode =
        typeof item === 'string' || typeof item === 'number' ? String(item) : JSON.stringify(item);
      return <li key={i}>{node}</li>;
    }),
  );
}
