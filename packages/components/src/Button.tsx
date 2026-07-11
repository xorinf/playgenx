import * as React from 'react';
import { colors, radius } from './theme.js';

/**
 * Headless-style wrapper over `<button>` accepting the props defined in
 * `DEFAULT_COMPONENT_SCHEMAS.Button`. Pass `onClick` through; this
 * implementation does NOT execute arbitrary functions (deterministic
 * renderer constraint) so the click handler is rendered inert at mount.
 */
export interface ButtonProps {
  /** Visible text. Required. */
  label: string;
  /** Variant. Defaults to 'primary'. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Disabled state. Defaults to false. */
  disabled?: boolean;
  /**
   * Optional click handler. The default impl forwards to onClick if
   * present; in a deterministic renderer pass `noEvents` instead.
   */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function Button({
  label,
  variant = 'primary',
  disabled = false,
  onClick,
}: ButtonProps): React.JSX.Element {
  const styles: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: 500,
    padding: '8px 14px',
    borderRadius: radius.md,
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background:
      variant === 'primary'
        ? colors.primary
        : variant === 'secondary'
          ? colors.secondaryFg
          : 'transparent',
    color:
      variant === 'ghost' ? colors.ghostFg : variant === 'secondary' ? colors.bg : colors.primaryFg,
    borderColor: variant === 'ghost' ? colors.border : 'transparent',
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={styles} data-pgx="Button">
      {label}
    </button>
  );
}
