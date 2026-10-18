import React, { useEffect, useRef, useState } from 'react';

export interface ChartPoint {
  /** Axis label */
  label: string;
  /** Label in the tooltip (defaults to `label`) */
  tooltipLabel?: string;
  value: number;
}

interface MiniChartProps {
  points: ChartPoint[];
  kind: 'bar' | 'line';
  /** What the value is, for the tooltip and screen readers (e.g. "Revenue") */
  seriesName: string;
  format?: (v: number) => string;
  height?: number;
}

// One series, so one hue: the app's teal (passes contrast on the light and dark cards)
const SERIES = 'var(--info-teal, #199eae)';
const PAD = { top: 12, right: 10, bottom: 26, left: 52 };

function niceMax(max: number, whole: boolean): number {
  // Counts get whole-number gridlines (a step of at least 1)
  if (whole && max <= 4) return 4;
  if (max <= 0) return 1;
  // Smallest "nice" step (1, 2, 2.5, 5 × a power of ten) whose four gridlines cover the max
  const pow = Math.pow(10, Math.floor(Math.log10(max)) - 1);
  const step = [1, 2, 2.5, 5, 10, 20, 25, 50, 100].map((s) => s * pow).find((s) => s * 4 >= max) || pow * 100;
  return step * 4;
}

/**
 * A small single-series chart in plain SVG: bars or a 2px line, one y-axis with four gridlines,
 * thinned x labels, and a hover / focus tooltip. The super admin app has no chart library.
 */
export function MiniChart({ points, kind, seriesName, format = (v) => v.toLocaleString('en-IN'), height = 220 }: MiniChartProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.max(240, entries[0].contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const whole = points.every((p) => Number.isInteger(p.value));
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)), whole);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const slot = n ? plotW / n : plotW;
  const cx = (i: number) => PAD.left + slot * i + slot / 2;
  const barW = Math.max(2, Math.min(28, slot - 2)); // 2px surface gap between bars
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))));
  const ticks = [0, 1, 2, 3, 4].map((k) => (max / 4) * k);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - PAD.left) / slot);
    setHover(i >= 0 && i < n ? i : null);
  };

  const linePath = points.map((p, i) => `${i ? 'L' : 'M'}${cx(i)},${y(p.value)}`).join(' ');
  const active = hover !== null ? points[hover] : null;

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${seriesName}: ${points.map((p) => `${p.tooltipLabel || p.label} ${format(p.value)}`).join(', ')}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border-color)" strokeDasharray={t ? '3 3' : undefined} />
            <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={`x${i}`} x={cx(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
              {p.label}
            </text>
          ) : null,
        )}
        {hover !== null && kind === 'line' && (
          <line x1={cx(hover)} x2={cx(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--text-muted)" strokeDasharray="2 3" />
        )}
        {kind === 'bar' &&
          points.map((p, i) => {
            const h = Math.max(0, PAD.top + plotH - y(p.value));
            const r = Math.min(4, h / 2, barW / 2);
            const x = cx(i) - barW / 2;
            const top = PAD.top + plotH - h;
            // Rounded data end, square at the baseline
            const d = h <= 0 ? '' : `M${x},${PAD.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${PAD.top + plotH} Z`;
            return d ? <path key={`b${i}`} d={d} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.55} /> : null;
          })}
        {kind === 'line' && n > 0 && (
          <>
            <path d={linePath} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              n <= 31 || hover === i ? (
                <circle key={`c${i}`} cx={cx(i)} cy={y(p.value)} r={hover === i ? 5 : 3} fill={SERIES} stroke="var(--bg-card, #fff)" strokeWidth={2} />
              ) : null,
            )}
          </>
        )}
        {/* Invisible, focusable hit areas wider than the marks */}
        {points.map((p, i) => (
          <rect
            key={`h${i}`}
            x={PAD.left + slot * i}
            y={PAD.top}
            width={slot}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={`${p.tooltipLabel || p.label}: ${format(p.value)}`}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          />
        ))}
      </svg>
      {active && hover !== null && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: Math.max(0, y(active.value) - 48),
            left: Math.min(Math.max(0, cx(hover) - 70), width - 140),
            width: 140,
            pointerEvents: 'none',
            background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            boxShadow: '0 6px 18px rgba(15, 23, 42, 0.12)',
            padding: '6px 8px',
            fontSize: 12,
          }}
        >
          <div style={{ color: 'var(--text-muted)' }}>{active.tooltipLabel || active.label}</div>
          <div style={{ fontWeight: 700, color: 'var(--text-main, #111)' }}>
            {seriesName}: {format(active.value)}
          </div>
        </div>
      )}
    </div>
  );
}
