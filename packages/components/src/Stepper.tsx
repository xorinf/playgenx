import * as React from 'react';
import { colors } from './theme.js';

export interface Step {
  id: string;
  title: string;
  body?: React.ReactNode;
}

export interface StepperProps {
  steps: Step[];
  /** 0-indexed initial step. Out-of-range falls back to 0. */
  initial?: number;
}

/**
 * Multi-step reveal. State: the active index. Previous steps can be
 * revisited; future steps are disabled until reached.
 */
export function Stepper({ steps, initial }: StepperProps): React.JSX.Element {
  const initialIdx = clampIndex(initial ?? 0, steps.length);
  const [active, setActive] = React.useState(initialIdx);
  const wrapStyle: React.CSSProperties = {
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };
  const listStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  };
  const stepBtnBase: React.CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    fontSize: '12px',
    fontWeight: 600,
    border: '1px solid transparent',
  };
  const bodyStyle: React.CSSProperties = {
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    padding: '10px',
    background: colors.bg,
    color: colors.fg,
  };
  return (
    <div data-pgx="Stepper" style={wrapStyle}>
      <ol style={listStyle}>
        {steps.map((s, i) => {
          const isPast = i < active;
          const isCurrent = i === active;
          const future = i > active;
          const stepStyle: React.CSSProperties = {
            ...stepBtnBase,
            background: isCurrent ? colors.stepperCurrent : isPast ? colors.stepperPast : colors.stepperFuture,
            color: isCurrent || isPast ? '#fff' : colors.fg,
            opacity: future ? 0.6 : 1,
            cursor: future ? 'not-allowed' : 'pointer',
          };
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={isCurrent ? 'step' : undefined}
                disabled={future}
                onClick={() => setActive(i)}
                style={stepStyle}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      <div style={bodyStyle}>
        <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '14px' }}>
          {steps[active]?.title ?? ''}
        </div>
        <div style={{ fontSize: '13px' }}>{steps[active]?.body ?? null}</div>
      </div>
    </div>
  );
}

function clampIndex(n: number, len: number): number {
  if (len === 0) return 0;
  if (!Number.isFinite(n)) return 0;
  return Math.min(len - 1, Math.max(0, Math.floor(n)));
}
