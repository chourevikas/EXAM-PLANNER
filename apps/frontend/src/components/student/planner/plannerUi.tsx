import React from 'react';
import { Lock } from 'lucide-react';

export const card: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius)',
  padding: 'clamp(16px, 3vw, 24px)',
  boxShadow: 'var(--shadow-color-base)',
};

export const h2: React.CSSProperties = { fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' };
export const sub: React.CSSProperties = { fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px' };
export const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' };

export const input: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  fontSize: 14,
  boxSizing: 'border-box',
};

export const btn = (solid = false): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius)',
  border: solid ? 'none' : '1px solid var(--border-default)', cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
  backgroundColor: solid ? 'var(--accent-primary)' : 'var(--bg-card)', color: solid ? '#fff' : 'var(--text-primary)',
});

export const smallBtn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)', background: 'var(--bg-card)',
  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

export function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled}
      style={{
        padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${on ? 'var(--accent-primary)' : 'var(--border-default)'}`,
        backgroundColor: on ? 'var(--accent-bg)' : 'var(--bg-card)', color: on ? 'var(--accent-primary)' : 'var(--text-secondary)',
        opacity: disabled ? 0.55 : 1,
      }}>
      {children}
    </button>
  );
}

export function Check({ on, onChange, children, disabled }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 13.5, color: 'var(--text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)' }} />
      <span>{children}</span>
    </label>
  );
}

export function Bar({ done, total, color = 'var(--accent-primary)' }: { done: number; total: number; color?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
      style={{ height: 8, borderRadius: 999, backgroundColor: 'var(--bg-subtle)', overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, transition: 'width .3s' }} />
    </div>
  );
}

export function CountRows({ rows }: { rows: { name: string; total: number; done: number }[] }) {
  if (!rows.length) return <p style={{ ...sub, margin: 0 }}>Nothing here yet.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div key={r.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 160px) 1fr 52px', gap: 10, alignItems: 'center', fontSize: 13 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={r.name}>{r.name}</span>
          <Bar done={r.done} total={r.total} />
          <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{r.done}/{r.total}</span>
        </div>
      ))}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'ok'; children: React.ReactNode }) {
  const c = {
    info: ['var(--accent-bg)', 'var(--accent-primary)', 'var(--accent-border)'],
    ok: ['#ECFDF5', '#047857', '#A7F3D0'],
    warn: ['#FFFBEB', '#92400E', '#FDE68A'],
    error: ['#FEF2F2', '#B91C1C', '#FECACA'],
  }[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'}
      style={{ padding: '10px 14px', borderRadius: 'var(--radius)', backgroundColor: c[0], color: c[1], border: `1px solid ${c[2]}`, fontSize: 13.5, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}

/** Pro-only badge for locked controls. */
export function ProTag() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 999, backgroundColor: '#FEF3C7', color: '#92400E', marginLeft: 6, verticalAlign: 'middle' }}>
      <Lock size={10} /> PRO
    </span>
  );
}

/** Renders **bold** segments from the tips text. */
export function RichText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
}

// ── Dates (local calendar days, matching the IST days the API plans in) ──
const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k: string, n: number) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
export const mondayOf = (k: string) => { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dateKey(d); };
export const todayKey = () => dateKey(new Date());
export const fmt = (k: string, o: Intl.DateTimeFormatOptions) => parseKey(k).toLocaleDateString('en-IN', o);

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const SUBJECT_COLORS: Record<string, [string, string]> = {
  Revision: ['#FFF7E6', '#A86D0A'],
  'Mock Test': ['#FDEBEC', '#C73338'],
  'Current Affairs': ['#E8F1FF', '#2563EB'],
  'PYQ Practice': ['#EEF2FF', '#4F46E5'],
  'Answer Writing': ['#F3E8FF', '#7E22CE'],
  'My task': ['#F1F5F9', '#475569'],
};

export function SubjectTag({ subject }: { subject: string | null }) {
  const [bg, fg] = SUBJECT_COLORS[subject || ''] || ['var(--bg-subtle)', 'var(--text-secondary)'];
  return <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: bg, color: fg }}>{subject || 'Task'}</span>;
}
