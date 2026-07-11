import * as React from 'react';
import { colors, radius } from './theme.js';

export interface TextFieldProps {
  label?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * onChange is reported as `node` in the schema (it must be a
   * function reference, which the validator cannot statically type).
   * We forward to React's controlled input handler.
   */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

/**
 * Controlled text input. Without `value`/`onChange`, behaves as
 * uncontrolled (uses its own state via defaultValue). When a stable
 * (deterministic) caller wires both, the input is fully controlled.
 */
export function TextField({
  label,
  value,
  placeholder,
  disabled = false,
  onChange,
}: TextFieldProps): React.JSX.Element {
  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: colors.mutedFg,
  };
  const inputStyle: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: '14px',
    padding: '8px 10px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: colors.bg,
    color: colors.fg,
    outline: 'none',
  };
  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    placeholder,
    disabled,
    onChange,
  };
  // Use uncontrolled defaultValue when caller omits value. We can't
  // set defaultValue AND value without React warning, so branch.
  if (value !== undefined) inputProps.value = value;
  else inputProps.defaultValue = '';
  return (
    <label style={wrapperStyle} data-pgx="TextField">
      {label !== undefined ? <span style={labelStyle}>{label}</span> : null}
      <input {...inputProps} style={inputStyle} />
    </label>
  );
}
