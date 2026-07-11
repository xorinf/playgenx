import * as React from 'react';

export interface ContainerProps {
  padding?: string;
  gap?: string;
  children?: React.ReactNode;
}

/**
 * Layout wrapper. Defaults to a vertical flex container with 16px
 * padding and 12px gap when callers omit props.
 */
export function Container({ padding, gap, children }: ContainerProps): React.JSX.Element {
  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: padding ?? '16px',
    gap: gap ?? '12px',
    fontFamily: 'inherit',
    color: 'inherit',
    boxSizing: 'border-box',
  };
  return (
    <div style={style} data-pgx="Container">
      {children}
    </div>
  );
}
