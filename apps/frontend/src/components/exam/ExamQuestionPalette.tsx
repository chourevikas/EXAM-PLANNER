import React, { useEffect } from 'react';
import { QuestionPaletteItem } from '../../types/exam';
import { X } from 'lucide-react';

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
  isOverlay?: boolean;
  onCloseOverlay?: () => void;
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
  isOverlay = false,
  onCloseOverlay,
}: ExamQuestionPaletteProps) {
  const totalCount = palette ? palette.length : questions.length || 10;

  // Lock body scroll and listen for Escape when in full-screen overlay mode
  useEffect(() => {
    if (isOverlay) {
      document.body.classList.add('scroll-lock');
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onCloseOverlay) {
          onCloseOverlay();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.classList.remove('scroll-lock');
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOverlay, onCloseOverlay]);

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

  const handlePickQuestion = (idx: number) => {
    onSelectQuestion(idx);
    if (isOverlay && onCloseOverlay) {
      onCloseOverlay();
    }
  };

  const content = (
    <>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: '#1E3A8A',
              letterSpacing: '0.08em',
            }}
          >
            QUESTION Review
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#475569',
              backgroundColor: '#F8FAFC',
              padding: '2px 8px',
              borderRadius: 0,
              border: '1px solid #E2E8F0',
            }}
          >
            {totalCount} Questions
          </span>
        </div>

        {isOverlay && onCloseOverlay && (
          <button
            type="button"
            onClick={onCloseOverlay}
            className="touch-target"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close question palette"
          >
            <X size={20} />
          </button>
        )}
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
            borderRadius: 0,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#166534',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Answered
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#15803D',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {answeredCount}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>/ {totalCount}</span>
          </div>
        </div>

        {/* Marked Panel */}
        <div
          style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FEF3C7',
            borderRadius: 0,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#92400E',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Marked
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#B45309',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {markedCount}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Segmented Filter Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 3,
          marginBottom: 14,
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 0,
          padding: 3,
          boxSizing: 'border-box',
        }}
      >
        {[
          { key: 'all', label: 'All' },
          { key: 'answered', label: 'Answered' },
          { key: 'marked', label: 'Marked' },
          { key: 'unanswered', label: 'Unans.' },
        ].map((tab) => {
          const isActive = paletteFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onFilterChange(tab.key as any)}
              className="touch-target center-content"
              style={{
                padding: '6px 2px',
                borderRadius: 0,
                border: 'none',
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#1E3A8A' : '#64748B',
                fontSize: 11,
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                transition: 'all 0.15s ease',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={tab.key}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4. Question Number Grid */}
      <div
        className="no-scrollbar"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
          gap: 6,
          overflowY: 'auto',
          overflowX: 'hidden',
          alignContent: 'start',
          padding: 2,
          marginBottom: 14,
          maxHeight: isOverlay ? '55vh' : 'auto',
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: totalCount }).map((_, idx) => {
          const status = getQStatus(idx);
          const isCurrent = currentQIndex === idx;

          if (
            paletteFilter === 'answered' &&
            status !== 'ANSWERED' &&
            status !== 'ANSWERED_AND_MARKED'
          )
            return null;
          if (
            paletteFilter === 'marked' &&
            status !== 'MARKED_FOR_REVIEW' &&
            status !== 'ANSWERED_AND_MARKED'
          )
            return null;
          if (
            paletteFilter === 'unanswered' &&
            (status === 'ANSWERED' || status === 'ANSWERED_AND_MARKED')
          )
            return null;

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
            bgColor = '#E2E8F0';
            textColor = '#A4161A';
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
              onClick={() => handlePickQuestion(idx)}
              className="touch-target center-content"
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                minHeight: 34,
                maxHeight: 44,
                borderRadius: 0,
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                color: textColor,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                transition: 'all 0.15s ease',
                fontVariantNumeric: 'tabular-nums',
                boxShadow: isCurrent
                  ? '0 2px 8px rgba(23, 32, 51, 0.3)'
                  : '0 1px 2px rgba(15, 23, 42, 0.02)',
                boxSizing: 'border-box',
                padding: 0,
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
            className="touch-target"
            style={{
              width: '100%',
              padding: '10px 0',
              borderRadius: 0,
              border: isRevealed ? '1px solid #CBD5E1' : '1px solid var(--primary-red)',
              backgroundColor: isRevealed ? '#F1F5F9' : 'var(--primary-red)',
              color: isRevealed ? '#64748B' : '#FFFFFF',
              fontSize: 13,
              fontWeight: 700,
              cursor: isRevealed ? 'default' : 'pointer',
              boxShadow: isRevealed ? 'none' : '0 2px 6px rgba(var(--primary-red-rgb), 0.2)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isRevealed) {
                e.currentTarget.style.backgroundColor = 'var(--accent-darker)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRevealed) {
                e.currentTarget.style.backgroundColor = 'var(--primary-red)';
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
            className="touch-target"
            style={{
              width: '100%',
              padding: '10px 0',
              borderRadius: 0,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#172033',
              fontSize: 13,
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
    </>
  );

  if (isOverlay) {
    return (
      <div className="auth-modal-overlay" onClick={onCloseOverlay} role="dialog" aria-modal="true">
        <div
          className="auth-modal-card"
          style={{ maxWidth: 480, maxHeight: '85vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <aside
      className="exam-palette-sidebar"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 14px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
        fontFamily: "'Manrope', 'Inter', system-ui, sans-serif",
      }}
    >
      {content}
    </aside>
  );
}
