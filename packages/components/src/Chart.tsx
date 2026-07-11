import * as React from 'react';
import { colors } from './theme.js';

export type ChartKind = 'bar' | 'line' | 'pie';

/**
 * The schema lets `data` be any ReactNode, but in practice callers
 * pass JSON-shaped arrays. We narrow at runtime:
 *
 *  - bar: `{ labels: string[], values: number[] }`
 *  - line: `{ x: number[], y: number[] }` or `{ series: { label, points: {x,y} }[] }`
 *  - pie: `{ labels: string[], values: number[] }`
 *
 * Anything that doesn't fit is rendered as a `<pre>` fallback.
 */
export interface ChartProps {
  kind: ChartKind;
  data: unknown;
  title?: string;
}

export function Chart({ kind, data, title }: ChartProps): React.JSX.Element {
  return (
    <div data-pgx="Chart" data-chart-kind={kind} style={{ fontFamily: 'inherit' }}>
      {title !== undefined ? (
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.fg, marginBottom: '6px' }}>
          {title}
        </div>
      ) : null}
      {renderChart(kind, data)}
    </div>
  );
}

function renderChart(kind: ChartKind, data: unknown): React.JSX.Element {
  if (kind === 'bar') return renderBar(data);
  if (kind === 'line') return renderLine(data);
  return renderPie(data);
}

function renderBar(data: unknown): React.JSX.Element {
  const parsed = parseLabeled(data);
  if (!parsed) return fallback('bar chart', data);
  const { labels, values } = parsed;
  const max = Math.max(1, ...values);
  const width = 320;
  const height = 160;
  const barWidth = width / Math.max(1, labels.length);
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Bar chart"
      style={{ display: 'block' }}
    >
      {values.map((v, i) => {
        const h = (Math.max(0, v) / max) * (height - 24);
        return (
          <g key={i}>
            <rect
              x={i * barWidth + 2}
              y={height - 12 - h}
              width={Math.max(1, barWidth - 4)}
              height={h}
              fill={colors.bar}
              rx={2}
            />
            <text
              x={i * barWidth + barWidth / 2}
              y={height - 2}
              fontSize={10}
              textAnchor="middle"
              fill={colors.barLabel}
            >
              {(labels[i] ?? '').slice(0, 8)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function renderLine(data: unknown): React.JSX.Element {
  // Two accepted shapes; pick whichever parses cleanly.
  let points: Array<{ x: number; y: number }> = [];
  if (data && typeof data === 'object' && 'series' in (data as Record<string, unknown>)) {
    const series = (data as { series: Array<{ points?: Array<{ x: number; y: number }> }> }).series;
    const first = series?.[0];
    points = Array.isArray(first?.points) ? first.points : [];
  } else if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { x?: unknown }).x) &&
    Array.isArray((data as { y?: unknown }).y)
  ) {
    const xArr = (data as { x: number[] }).x;
    const yArr = (data as { y: number[] }).y;
    points = xArr.map((x, i) => ({ x, y: yArr[i] ?? 0 }));
  }
  if (points.length === 0) return fallback('line chart', data);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const w = 320;
  const h = 160;
  const sx = (x: number) => (xMax === xMin ? w / 2 : ((x - xMin) / (xMax - xMin)) * (w - 8) + 4);
  const sy = (y: number) =>
    yMax === yMin ? h / 2 : h - ((y - yMin) / (yMax - yMin)) * (h - 24) - 12;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`)
    .join(' ');
  return (
    <svg width={w} height={h} role="img" aria-label="Line chart" style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={colors.line} strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2} fill={colors.line} />
      ))}
    </svg>
  );
}

function renderPie(data: unknown): React.JSX.Element {
  const parsed = parseLabeled(data);
  if (!parsed) return fallback('pie chart', data);
  const total = parsed.values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const cx = 80;
  const cy = 80;
  const r = 60;
  let angle = -Math.PI / 2;
  return (
    <svg width={160} height={160} role="img" aria-label="Pie chart" style={{ display: 'block' }}>
      {parsed.values.map((v, i) => {
        const slice = (Math.max(0, v) / total) * Math.PI * 2;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(angle + slice);
        const y2 = cy + r * Math.sin(angle + slice);
        const large = slice > Math.PI ? 1 : 0;
        const path =
          slice >= Math.PI * 2 - 1e-6
            ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
            : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        angle += slice;
        const fill = colors.pie[i % colors.pie.length] ?? colors.bar;
        return <path key={i} d={path} fill={fill} />;
      })}
    </svg>
  );
}

function parseLabeled(data: unknown): { labels: string[]; values: number[] } | null {
  if (!data || typeof data !== 'object') return null;
  const labels = (data as { labels?: unknown }).labels;
  const values = (data as { values?: unknown }).values;
  if (!Array.isArray(labels) || !Array.isArray(values)) return null;
  if (labels.length !== values.length) return null;
  if (!labels.every((l) => typeof l === 'string' || typeof l === 'number')) return null;
  if (!values.every((v) => typeof v === 'number' || typeof v === 'string')) return null;
  return {
    labels: labels.map(String),
    values: values.map((v) => (typeof v === 'number' ? v : Number(v))),
  };
}

function fallback(label: string, data: unknown): React.JSX.Element {
  return (
    <pre
      style={{
        margin: 0,
        fontSize: '12px',
        background: colors.codeBg,
        color: colors.codeFg,
        padding: '8px',
        borderRadius: '4px',
        overflow: 'auto',
      }}
    >
      {label} data: {JSON.stringify(data, null, 2)}
    </pre>
  );
}
