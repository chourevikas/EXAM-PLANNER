import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { QuestionPaletteItem } from '../../types/exam';

interface ExamQuestionPaletteProps {
  questions?: any[];
  palette?: QuestionPaletteItem[];
  currentQIndex: number;
  selectedOptions?: Record<number, string>;
  markedForReview?: Record<number, boolean>;
  paletteFilter: 'all' | 'answered' | 'marked' | 'unanswered';
  onSelectQuestion: (idx: number) => void;
  onFilterChange: (filter: 'all' | 'answered' | 'marked' | 'unanswered') => void;
}

export function ExamQuestionPalette({
  questions = [],
  palette,
  currentQIndex,
  selectedOptions = {},
  markedForReview = {},
  paletteFilter,
  onSelectQuestion,
  onFilterChange,
}: ExamQuestionPaletteProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const totalCount = palette ? palette.length : questions.length;

  const getQStatus = (index: number): string => {
    if (palette && palette[index]) {
      return palette[index].question_status;
    }
    const isAnswered = selectedOptions[index] !== undefined;
    const isMarked = !!markedForReview[index];

    if (isAnswered && isMarked) return 'ANSWERED_AND_MARKED';
    if (isAnswered) return 'ANSWERED';
    if (isMarked) return 'MARKED_FOR_REVIEW';
    return 'UNVISITED';
  };

  return (
    <aside
      style={{
        width: 300,
        backgroundColor: isDark ? '#0f1e3c' : '#ffffff',
        borderLeft: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        boxSizing: 'border-box',
        flexShrink: 0,
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', marginBottom: 12 }}>
        Question Palette
      </div>

      {/* Legend Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#10b981' }} />
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#475569' }}>Answered</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#f59e0b' }} />
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#475569' }}>Review</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#2563eb' }} />
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#475569' }}>Ans & Review</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1' }} />
          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#475569' }}>Unvisited</span>
        </div>
      </div>

      {/* Palette Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
          borderRadius: 8,
          padding: 3,
        }}
      >
        {(['all', 'answered', 'marked', 'unanswered'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onFilterChange(tab)}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 6,
              border: 'none',
              backgroundColor: paletteFilter === tab ? '#2563eb' : 'transparent',
              color: paletteFilter === tab ? '#ffffff' : isDark ? 'rgba(255,255,255,0.7)' : '#64748b',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Question Grid Numbers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          flex: 1,
          overflowY: 'auto',
          alignContent: 'start',
        }}
      >
        {Array.from({ length: totalCount }).map((_, idx) => {
          const status = getQStatus(idx);
          const isCurrent = currentQIndex === idx;

          if (paletteFilter === 'answered' && status !== 'ANSWERED' && status !== 'ANSWERED_AND_MARKED') return null;
          if (paletteFilter === 'marked' && status !== 'MARKED_FOR_REVIEW' && status !== 'ANSWERED_AND_MARKED') return null;
          if (paletteFilter === 'unanswered' && (status === 'ANSWERED' || status === 'ANSWERED_AND_MARKED')) return null;

          let bgColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
          let textColor = isDark ? '#ffffff' : '#0f172a';

          if (status === 'ANSWERED') {
            bgColor = '#10b981';
            textColor = '#ffffff';
          } else if (status === 'MARKED_FOR_REVIEW') {
            bgColor = '#f59e0b';
            textColor = '#ffffff';
          } else if (status === 'ANSWERED_AND_MARKED') {
            bgColor = '#2563eb';
            textColor = '#ffffff';
          } else if (status === 'VISITED') {
            bgColor = isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7';
            textColor = isDark ? '#fde68a' : '#d97706';
          }

          return (
            <button
              key={idx}
              onClick={() => onSelectQuestion(idx)}
              style={{
                height: 38,
                borderRadius: 8,
                border: isCurrent
                  ? isDark
                    ? '2px solid #ffffff'
                    : '2px solid #0f172a'
                  : '1px solid transparent',
                backgroundColor: bgColor,
                color: textColor,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isCurrent ? '0 0 10px rgba(37,99,235,0.4)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

