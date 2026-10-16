import React from 'react';

export interface DifficultyRow {
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  /** Of attempted questions; null when none were attempted. */
  accuracy_pct: number | null;
  avg_time_seconds: number | null;
}

const LEVELS = ['EASY', 'MEDIUM', 'HARD'] as const;

const LEVEL_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  EASY: { label: 'Easy', color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  MEDIUM: { label: 'Medium', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  HARD: { label: 'Hard', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
};

/**
 * Same breakdown the backend stores as part_2_exam_macro_scorecard.difficulty_breakdown, computed from the
 * per-question rows, for reports generated before that field existed.
 */
export function computeDifficultyBreakdown(questions: any[]): DifficultyRow[] {
  const levelOf = (q: any) => {
    const level = String(q?.difficulty || 'MEDIUM').toUpperCase();
    return (LEVELS as readonly string[]).includes(level) ? level : 'MEDIUM';
  };
  return LEVELS.flatMap((level) => {
    const qs = questions.filter((q) => levelOf(q) === level);
    if (qs.length === 0) return [];
    const attempted = qs.filter((q) => q.is_attempted);
    const correct = attempted.filter((q) => q.is_correct).length;
    const times = attempted.map((q) => Number(q.time_taken_seconds || 0));
    return [{
      difficulty: level,
      total: qs.length,
      attempted: attempted.length,
      correct,
      incorrect: attempted.length - correct,
      unattempted: qs.length - attempted.length,
      accuracy_pct: attempted.length ? Math.round((correct * 1000) / attempted.length) / 10 : null,
      avg_time_seconds: times.length ? Math.round((times.reduce((a, b) => a + b, 0) * 10) / times.length) / 10 : null,
    }];
  });
}

/** One factual takeaway from the breakdown, or null when nothing stands out. */
function takeaway(rows: DifficultyRow[]): string | null {
  const by = Object.fromEntries(rows.map((r) => [r.difficulty, r]));
  const easy = by.EASY;
  const harder = [by.MEDIUM, by.HARD].filter((r): r is DifficultyRow => !!r && r.accuracy_pct != null);
  if (easy && easy.accuracy_pct != null && harder.some((r) => (r.accuracy_pct as number) > (easy.accuracy_pct as number))) {
    return `Easy questions scored lower (${easy.accuracy_pct}%) than harder ones. Slow down and read easy questions fully before answering.`;
  }
  if (easy && easy.unattempted > 0) {
    return `You left ${easy.unattempted} easy question${easy.unattempted === 1 ? '' : 's'} unanswered. These are the quickest marks to pick up.`;
  }
  const hard = by.HARD;
  if (hard && hard.accuracy_pct != null && hard.accuracy_pct < 40 && hard.attempted >= 3) {
    return `Hard questions were ${hard.accuracy_pct}% accurate. Attempt them only when you can rule out two options.`;
  }
  return null;
}

function formatTime(seconds: number | null): string {
  if (seconds == null) return '—';
  const s = Math.round(seconds);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

interface Props {
  rows: DifficultyRow[];
  /** Section container and heading styles, so the card matches the report section it sits in. */
  cardStyle: React.CSSProperties;
  titleStyle: React.CSSProperties;
}

export function DifficultyAnalysisCard({ rows, cardStyle, titleStyle }: Props) {
  if (rows.length === 0) return null;
  const note = takeaway(rows);

  return (
    <section style={cardStyle} aria-label="Difficulty analysis">
      <h3 style={titleStyle}>By difficulty</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 12 }}>
        {rows.map((r) => {
          const st = LEVEL_STYLE[r.difficulty] || LEVEL_STYLE.MEDIUM;
          return (
            <div
              key={r.difficulty}
              data-testid={`difficulty-${r.difficulty}`}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                border: `1px solid ${st.border}`,
                backgroundColor: st.bg,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.total} Qs</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: st.color }}>
                {r.accuracy_pct != null ? `${r.accuracy_pct}%` : '—'}
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 6 }}>accuracy</span>
              </div>
              <div style={{ height: 6, borderRadius: 'var(--radius)', backgroundColor: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${r.accuracy_pct ?? 0}%`, height: '100%', backgroundColor: st.color }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {r.correct} correct · {r.incorrect} wrong · {r.unattempted} skipped
                <br />
                Avg time: {formatTime(r.avg_time_seconds)}
              </div>
            </div>
          );
        })}
      </div>

      {note && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{note}</p>
      )}
    </section>
  );
}
