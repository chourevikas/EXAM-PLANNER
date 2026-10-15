import React, { useEffect, useState } from 'react';

interface ReportPreparingLoaderProps {
  /** Real progress (0-100) when the server reports it; otherwise the bar fills gradually on its own. */
  progress?: number;
  /** "overlay" covers the whole screen (exam submit); "inline" sits in the page (analytics). */
  variant?: 'overlay' | 'inline';
  title?: string;
}

/** Simple "Preparing your report" loader with a progress bar, shown after a test is submitted. */
export function ReportPreparingLoader({ progress, variant = 'inline', title = 'Preparing your report…' }: ReportPreparingLoaderProps) {
  // Creeps towards 90% so the bar always moves; it never claims to be done before the report is.
  const [simulated, setSimulated] = useState(8);
  useEffect(() => {
    const id = setInterval(() => setSimulated((p) => (p >= 90 ? p : p + Math.max(1, (90 - p) * 0.08))), 400);
    return () => clearInterval(id);
  }, []);

  const shown = Math.round(Math.min(99, Math.max(simulated, progress ?? 0)));
  const overlay = variant === 'overlay';

  const card = (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: '100%',
        maxWidth: 420,
        padding: '28px 24px',
        borderRadius: 'var(--radius)',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: overlay ? '0 20px 40px rgba(0,0,0,0.25)' : 'var(--shadow-color-base)',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>This usually takes a few seconds.</div>
      <div
        role="progressbar"
        aria-label="Report progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        style={{ height: 8, borderRadius: 999, backgroundColor: 'var(--border-default)', overflow: 'hidden' }}
      >
        <div
          style={{
            height: '100%',
            width: `${shown}%`,
            backgroundColor: 'var(--primary-red)',
            borderRadius: 999,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginTop: 8 }}>{shown}%</div>
    </div>
  );

  if (!overlay) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>{card}</div>;
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {card}
    </div>
  );
}
