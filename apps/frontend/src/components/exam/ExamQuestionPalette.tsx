import React from 'react';
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
  onSubmitTest?: () => void;
  onRevealAnswer?: () => void;
  isRevealed?: boolean;
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
  onSubmitTest,
  onRevealAnswer,
  isRevealed = false,
}: ExamQuestionPaletteProps) {
  const totalCount = palette ? palette.length : questions.length || 10;

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

  // Compute metrics
  let answeredCount = 0;
  let markedCount = 0;

  for (let i = 0; i < totalCount; i++) {
    const st = getQStatus(i);
    if (st === 'ANSWERED' || st === 'ANSWERED_AND_MARKED') answeredCount++;
    if (st === 'MARKED_FOR_REVIEW' || st === 'ANSWERED_AND_MARKED') markedCount++;
  }

  return (
    <aside
      style={{
        width: 270,
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 18,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 14px',
        boxSizing: 'border-box',
        flexShrink: 0,
        height: 'fit-content',
        maxHeight: 'calc(100vh - 160px)',
        position: 'sticky',
        top: 20,
        marginRight: 24,
        marginTop: 12,
        overflow: 'hidden',
        boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
        fontFamily: "'Manrope', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* 1. Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid #F1F5F9',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#1E3A8A',
            letterSpacing: '0.08em',
          }}
        >
          QUESTION PALETTE
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#475569',
            backgroundColor: '#F8FAFC',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid #E2E8F0',
          }}
        >
          {totalCount} Questions
        </span>
      </div>

      {/* 2. Answer Status Summary Panels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 14,
        }}
      >
        {/* Answered Panel */}
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #DCFCE7',
            borderRadius: 10,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Answered
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#15803D', fontVariantNumeric: 'tabular-nums' }}>
              {answeredCount}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>
              / {totalCount}
            </span>
          </div>
        </div>

        {/* Marked Panel */}
        <div
          style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FEF3C7',
            borderRadius: 10,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Marked
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>
              {markedCount}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Segmented Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 3,
          marginBottom: 14,
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: 3,
        }}
      >
        {(['all', 'answered', 'marked', 'unanswered'] as const).map((tab) => {
          const isActive = paletteFilter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onFilterChange(tab)}
              style={{
                flex: 1,
                padding: '4px 0',
                borderRadius: 6,
                border: 'none',
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#1E3A8A' : '#64748B',
                fontSize: 10.5,
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
                boxShadow: isActive ? '0 1px 3px rgba(15, 23, 42, 0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* 4. Question Number Grid (5-column layout, rounded circular buttons) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          overflowY: 'auto',
          alignContent: 'start',
          paddingRight: 2,
          marginBottom: 14,
          maxHeight: 220,
        }}
      >
        {Array.from({ length: totalCount }).map((_, idx) => {
          const status = getQStatus(idx);
          const isCurrent = currentQIndex === idx;

          if (paletteFilter === 'answered' && status !== 'ANSWERED' && status !== 'ANSWERED_AND_MARKED') return null;
          if (paletteFilter === 'marked' && status !== 'MARKED_FOR_REVIEW' && status !== 'ANSWERED_AND_MARKED') return null;
          if (paletteFilter === 'unanswered' && (status === 'ANSWERED' || status === 'ANSWERED_AND_MARKED')) return null;

          // Default styling variables
          let bgColor = '#F8FAFC';
          let textColor = '#334155';
          let borderColor = '#E2E8F0';

          if (status === 'ANSWERED') {
            bgColor = '#DCFCE7';
            textColor = '#15803D';
            borderColor = '#86EFAC';
          } else if (status === 'MARKED_FOR_REVIEW') {
            bgColor = '#FEF3C7';
            textColor = '#B45309';
            borderColor = '#FDE68A';
          } else if (status === 'ANSWERED_AND_MARKED') {
            bgColor = '#DBEAFE';
            textColor = '#1E40AF';
            borderColor = '#93C5FD';
          }

          // Active / Current question styling override
          if (isCurrent) {
            bgColor = '#1E3A8A';
            textColor = '#FFFFFF';
            borderColor = '#1E3A8A';
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectQuestion(idx)}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                color: textColor,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                transition: 'all 0.15s ease',
                fontVariantNumeric: 'tabular-nums',
                boxShadow: isCurrent
                  ? '0 2px 8px rgba(30, 58, 138, 0.3)'
                  : '0 1px 2px rgba(15, 23, 42, 0.02)',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) {
                  e.currentTarget.style.borderColor = '#94A3B8';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) {
                  e.currentTarget.style.borderColor = borderColor;
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {String(idx + 1).padStart(2, '0')}
            </button>
          );
        })}
      </div>

      {/* 5. Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
        {onRevealAnswer && (
          <button
            type="button"
            onClick={onRevealAnswer}
            disabled={isRevealed}
            style={{
              width: '100%',
              padding: '9px 0',
              borderRadius: 8,
              border: isRevealed ? '1px solid #CBD5E1' : '1px solid #2563EB',
              backgroundColor: isRevealed ? '#F1F5F9' : '#2563EB',
              color: isRevealed ? '#64748B' : '#FFFFFF',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: isRevealed ? 'default' : 'pointer',
              boxShadow: isRevealed ? 'none' : '0 2px 6px rgba(37, 99, 235, 0.2)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isRevealed) {
                e.currentTarget.style.backgroundColor = '#1D4ED8';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRevealed) {
                e.currentTarget.style.backgroundColor = '#2563EB';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isRevealed ? '✓ Solution Revealed' : 'Submit & Show Solution'}
          </button>
        )}

        {onSubmitTest && (
          <button
            type="button"
            onClick={onSubmitTest}
            style={{
              width: '100%',
              padding: '9px 0',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#1E293B',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.borderColor = '#94A3B8';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Finish & View Diagnosis
          </button>
        )}
      </div>
    </aside>
  );
}

