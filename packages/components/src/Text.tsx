import * as React from 'react';
import { colors } from './theme.js';

export interface TextProps {
  weight?: 'normal' | 'bold';
  size?: string;
  color?: string;
  children?: React.ReactNode;
}

export function Text({ weight = 'normal', size, color, children }: TextProps): React.JSX.Element {
  const style: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: size ?? '14px',
    fontWeight: weight === 'bold' ? 600 : 400,
    color: color ?? colors.fg,
    margin: 0,
    lineHeight: 1.5,
  };
  return (
    <p style={style} data-pgx="Text">
      {children}
    </p>
  );
}
