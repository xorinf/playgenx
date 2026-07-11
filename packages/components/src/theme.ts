/**
 * Shared theme tokens for @playgenx/components.
 *
 * All styling is driven from this file. There is intentionally no
 * "config" theme or runtime theme provider — these are the default
 * implementations of the registry, and a downstream host app can swap
 * them out entirely. Tokens live as constants so they're stable
 * across renders and don't allocate per call.
 */

export const colors = {
  bg: '#ffffff',
  fg: '#0f172a',
  mutedFg: '#475569',
  border: '#e2e8f0',
  primary: '#2563eb',
  primaryFg: '#ffffff',
  secondaryFg: '#0f172a',
  ghostFg: '#1d4ed8',
  cardBg: '#f8fafc',
  cardBorder: '#e2e8f0',
  codeBg: '#f1f5f9',
  codeFg: '#0f172a',
  sliderTrack: '#cbd5e1',
  sliderFill: '#2563eb',
  sliderThumb: '#1d4ed8',
  bar: '#2563eb',
  barLabel: '#0f172a',
  pie: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626'],
  line: '#2563eb',
  stepperPast: '#16a34a',
  stepperCurrent: '#2563eb',
  stepperFuture: '#cbd5e1',
} as const;

export const space = {
  none: '0',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
} as const;

export const radius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
} as const;

/**
 * Common React-friendly prop accepts for content. Components that
 * accept children of arbitrary shape (Heading, Text, Card, Container,
 * ...) use this so the host can pass strings or JSX interchangeably.
 */
export type Children = string | number | React.ReactNode;

import type * as React from 'react';
