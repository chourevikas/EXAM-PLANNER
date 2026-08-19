import React from 'react';
import { LayoutGrid } from 'lucide-react';
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

  // Compute stats for Progress Summary
  let answeredCount = 0;
  let reviewCount = 0;

  for (let i = 0; i < totalCount; i++) {
    const st = getQStatus(i);
    if (st === 'ANSWERED' || st === 'ANSWERED_AND_MARKED') answeredCount++;
    if (st === 'MARKED_FOR_REVIEW' || st === 'ANSWERED_AND_MARKED') reviewCount++;
  }

  const remainingCount = Math.max(0, totalCount - answeredCount);

  return (
    <aside
      style={{
        width: 280,
        backgroundColor: '#F4F6F9',
        borderLeft: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 20px',
        boxSizing: 'border-box',
        flexShrink: 0,
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LayoutGrid size={16} color="#2563EB" />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#0F172A',
              letterSpacing: '0.08em',
            }}
          >
            QUESTION PALETTE
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#2563EB',
            backgroundColor: '#EFF6FF',
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid #DBEAFE',
          }}
        >
          {totalCount} Qs
        </span>
      </div>

      {/* Structured Metric Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 16,
          fontSize: 11,
          fontWeight: 600,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
        }}
      >
        <div style={{ color: '#475569' }}>
          TOTAL: <span style={{ color: '#0F172A', fontWeight: 700 }}>{totalCount}</span>
        </div>
        <div style={{ color: '#475569' }}>
          ANSWERED: <span style={{ color: '#059669', fontWeight: 700 }}>{answeredCount}</span>
        </div>
        <div style={{ color: '#475569' }}>
          REVIEW: <span style={{ color: '#D97706', fontWeight: 700 }}>{reviewCount}</span>
        </div>
        <div style={{ color: '#475569' }}>
          REMAINING: <span style={{ color: '#64748B', fontWeight: 700 }}>{remainingCount}</span>
        </div>
      </div>

      {/* Legend Dots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#059669' }} />
          <span style={{ color: '#475569', fontWeight: 500 }}>Answered</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D97706' }} />
          <span style={{ color: '#475569', fontWeight: 500 }}>Review</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563EB' }} />
          <span style={{ color: '#475569', fontWeight: 500 }}>Ans + Review</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#CBD5E1' }} />
          <span style={{ color: '#475569', fontWeight: 500 }}>Unvisited</span>
        </div>
      </div>

      {/* Segmented Filter Control */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginBottom: 18,
          backgroundColor: '#F1F5F9',
          borderRadius: 6,
          padding: 3,
        }}
      >
        {(['all', 'answered', 'marked', 'unanswered'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onFilterChange(tab)}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: 4,
              border: 'none',
              backgroundColor: paletteFilter === tab ? '#2563EB' : 'transparent',
              color: paletteFilter === tab ? '#FFFFFF' : '#64748B',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.15s ease',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Elevated Numbered Grid (40px x 40px, 8px radius) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
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

          let bgColor = '#FFFFFF';
          let textColor = '#475569';
          let borderColor = '#E2E8F0';

          if (status === 'ANSWERED') {
            bgColor = '#059669';
            textColor = '#FFFFFF';
            borderColor = '#047857';
          } else if (status === 'MARKED_FOR_REVIEW') {
            bgColor = '#D97706';
            textColor = '#FFFFFF';
            borderColor = '#B45309';
          } else if (status === 'ANSWERED_AND_MARKED') {
            bgColor = '#2563EB';
            textColor = '#FFFFFF';
            borderColor = '#1D4ED8';
          } else if (status === 'VISITED') {
            bgColor = '#EFF6FF';
            textColor = '#2563EB';
            borderColor = '#DBEAFE';
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectQuestion(idx)}
              style={{
                height: 40,
                borderRadius: 8,
                border: isCurrent ? '2px solid #2563EB' : `1px solid ${borderColor}`,
                backgroundColor: isCurrent && status !== 'ANSWERED' && status !== 'MARKED_FOR_REVIEW' && status !== 'ANSWERED_AND_MARKED' ? '#EFF6FF' : bgColor,
                color: isCurrent && status !== 'ANSWERED' && status !== 'MARKED_FOR_REVIEW' && status !== 'ANSWERED_AND_MARKED' ? '#2563EB' : textColor,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                fontVariantNumeric: 'tabular-nums',
                boxShadow: isCurrent ? '0 0 0 3px rgba(37,99,235,0.2)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.borderColor = '#CBD5E1';
                  e.currentTarget.style.boxShadow = '0 3px 8px rgba(15,23,42,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = borderColor;
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.04)';
                }
              }}
            >
              {String(idx + 1).padStart(2, '0')}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
