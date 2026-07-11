import * as React from 'react';
import { colors } from './theme.js';

export interface SliderProps {
  /** Lower bound, inclusive. Required. */
  min: number;
  /** Upper bound, inclusive. Required. */
  max: number;
  /** Initial / controlled value. */
  value?: number;
  /** Increment between stops. Defaults to 1. */
  step?: number;
  /** Optional caption rendered above the slider. */
  label?: string;
}

/**
 * Range input. State: internal `value` mirrors props.value if present
 * (otherwise uncontrolled); clamps to [min, max].
 */
export function Slider({ min, max, value, step = 1, label }: SliderProps): React.JSX.Element {
  // Controlled vs uncontrolled: React forbids both at once. Branch.
  const [internal, setInternal] = React.useState(() => clamp(value ?? min, min, max));
  const controlled = value !== undefined;
  const current = controlled ? clamp(value, min, max) : internal;
  const trackStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontFamily: 'inherit',
    width: '100%',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: colors.mutedFg,
  };
  const wrapStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px' };
  const inputStyle: React.CSSProperties = { flex: 1, accentColor: colors.sliderFill };
  const valueStyle: React.CSSProperties = {
    minWidth: '32px',
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontSize: '14px',
    color: colors.fg,
  };
  return (
    <div style={trackStyle} data-pgx="Slider">
      {label !== undefined ? <span style={labelStyle}>{label}</span> : null}
      <div style={wrapStyle}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          disabled={min === max}
          aria-label={label}
          onChange={(e) => {
            const next = Number(e.currentTarget.value);
            if (!controlled) setInternal(next);
          }}
          style={inputStyle}
        />
        <span style={valueStyle}>{current}</span>
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
