import React from 'react';

export interface QuestionTypeRow {
  question_type: string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  /** Of attempted questions; null when none were attempted. */
  accuracy_pct: number | null;
  avg_time_seconds: number | null;
}

const TYPE_PALETTE = [
  { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  { color: '#7E22CE', bg: '#FAF5FF', border: '#E9D5FF' },
  { color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  { color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
  { color: '#BE185D', bg: '#FDF2F8', border: '#FBCFE8' },
];

/**
 * Computes breakdown per question type from part_1_per_question_analysis rows.
 */
export function computeQuestionTypeBreakdown(questions: any[]): QuestionTypeRow[] {
  const groups: Record<string, any[]> = {};
  for (const q of questions) {
    const qType = q.question_type_tag || q.cognitive_skill;
    if (
      !qType ||
      ['conceptual reasoning', 'extraction stage initialized', 'none', ''].includes(
        String(qType).trim().toLowerCase()
      )
    ) {
      continue;
    }
    const clean = String(qType).trim();
    if (!groups[clean]) groups[clean] = [];
    groups[clean].push(q);
  }

  const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  return entries.map(([qType, qs]) => {
    const attempted = qs.filter((q) => q.is_attempted);
    const correct = attempted.filter((q) => q.is_correct).length;
    const times = attempted.map((q) => Number(q.time_taken_seconds || 0));
    return {
      question_type: qType,
      total: qs.length,
      attempted: attempted.length,
      correct,
      incorrect: attempted.length - correct,
      unattempted: qs.length - attempted.length,
      accuracy_pct: attempted.length
        ? Math.round((correct * 1000) / attempted.length) / 10
        : null,
      avg_time_seconds: times.length
        ? Math.round((times.reduce((a, b) => a + b, 0) * 10) / times.length) / 10
        : null,
    };
  });
}

function formatTime(seconds: number | null): string {
  if (seconds == null) return '—';
  const s = Math.round(seconds);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

interface Props {
  rows: QuestionTypeRow[];
  cardStyle: React.CSSProperties;
  titleStyle: React.CSSProperties;
}

export function QuestionTypeAnalysisCard({ rows, cardStyle, titleStyle }: Props) {
  if (!rows || rows.length === 0) return null;

  return (
    <section style={cardStyle} aria-label="Question type analysis">
      <h3 style={titleStyle}>By question type</h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 12,
        }}
      >
        {rows.map((r, i) => {
          const st = TYPE_PALETTE[i % TYPE_PALETTE.length];
          return (
            <div
              key={r.question_type}
              data-testid={`question-type-${r.question_type}`}
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: st.color }}>
                  {r.question_type}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {r.total} Qs
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: st.color }}>
                {r.accuracy_pct != null ? `${r.accuracy_pct}%` : '—'}
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginLeft: 6,
                  }}
                >
                  accuracy
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'rgba(15,23,42,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${r.accuracy_pct ?? 0}%`,
                    height: '100%',
                    backgroundColor: st.color,
                  }}
                />
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
    </section>
  );
}
