import * as React from 'react';
import { colors, radius, space } from './theme.js';

export interface CardProps {
  title?: string;
  /**
   * Visual elevation. 0 = flat (border only), 1+ = heavier shadow.
   * Defaults to 1.
   */
  elevation?: number;
  children?: React.ReactNode;
}

export function Card({ title, elevation = 1, children }: CardProps): React.JSX.Element {
  const shadow =
    elevation >= 3
      ? '0 4px 12px rgba(15, 23, 42, 0.18)'
      : elevation === 2
        ? '0 2px 8px rgba(15, 23, 42, 0.12)'
        : elevation === 1
          ? '0 1px 2px rgba(15, 23, 42, 0.06)'
          : 'none';
  const cardStyle: React.CSSProperties = {
    background: colors.cardBg,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: radius.md,
    boxShadow: shadow,
    padding: space.md,
    fontFamily: 'inherit',
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    gap: space.sm,
  };
  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
  };
  return (
    <section data-pgx="Card" style={cardStyle}>
      {title !== undefined ? <h3 style={titleStyle}>{title}</h3> : null}
      {children}
    </section>
  );
}
