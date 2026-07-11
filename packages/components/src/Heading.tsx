import * as React from 'react';
import { colors } from './theme.js';

export interface HeadingProps {
  /**
   * Heading level (1..6). Out-of-range or undefined falls back to 2.
   * The renderer should never see an `Undefined` value here unless the
   * schema validator said optional props can be omitted.
   */
  level?: number;
  color?: string;
  children?: React.ReactNode;
}

const sizes: Record<number, string> = {
  1: '24px',
  2: '20px',
  3: '18px',
  4: '16px',
  5: '14px',
  6: '13px',
};

export function Heading({ level, color, children }: HeadingProps): React.JSX.Element {
  const safeLevel = clampLevel(level);
  const size = sizes[safeLevel] ?? sizes[2]!;
  const style: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: size,
    fontWeight: 700,
    color: color ?? colors.fg,
    margin: 0,
    lineHeight: 1.3,
  };
  // Render an element corresponding to the level. React enforces
  // TagName = 'h1' | 'h2' ... via JSX, so we switch dynamically via
  // createElement.
  return React.createElement(`h${safeLevel}`, { style, 'data-pgx': `Heading` }, children);
}

function clampLevel(level: number | undefined): 1 | 2 | 3 | 4 | 5 | 6 {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 2;
  const i = Math.floor(level);
  if (i < 1) return 1;
  if (i > 6) return 6;
  return i as 1 | 2 | 3 | 4 | 5 | 6;
}
