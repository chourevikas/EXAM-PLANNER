import React from 'react';

/**
 * Spinner — single canonical loading indicator for the entire app.
 *
 * Usage:
 *   <Spinner />                  — default 32px, centred in its container
 *   <Spinner size={20} />        — smaller variant for section headers
 *   <Spinner size={48} />        — large full-page variant
 *   <Spinner label="Loading..." />  — adds accessible text below
 *   <Spinner inline />           — no wrapper div, use inside flex rows
 */

interface SpinnerProps {
  /** Diameter in px. Default 32. */
  size?: number;
  /** Accessible label shown beneath the spinner. */
  label?: string;
  /** When true renders just the ring with no centering wrapper. */
  inline?: boolean;
  /** Override the ring colour. Defaults to brand red var(--primary-red). */
  color?: string;
}

export function Spinner({
  size = 32,
  label,
  inline = false,
  color = 'var(--primary-red)',
}: SpinnerProps) {
  const thickness = Math.max(2, Math.round(size / 10));

  const ring = (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${thickness}px solid ${color}20`,
        borderTopColor: color,
        animation: 'spin-ring 0.75s linear infinite',
        flexShrink: 0,
      }}
    />
  );

  if (inline) return ring;

  return (
    <div
      role="status"
      aria-label={label || 'Loading'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '32px 0',
      }}
    >
      {ring}
      {label && (
        <span
          style={{
            fontSize: 13,
            color: '#9CA3AF',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
