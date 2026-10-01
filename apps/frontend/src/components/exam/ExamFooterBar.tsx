import React from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Flag, Grid } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { ConfidenceSelector } from './ConfidenceSelector';
import type { ConfidenceLevel } from '../../types/exam';

interface ExamFooterBarProps {
  isAnswered: boolean;
  isMarkedForReview: boolean;
  isFirstQuestion: boolean;
  isLastQuestion?: boolean;
  onClearResponse: () => void;
  onToggleMarkReview: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmitTest?: () => void;
  isRevealed?: boolean;
  onSubmitAnswer?: () => void;
  showClearResponse?: boolean;
  showMarkReview?: boolean;
  backgroundColor?: string;
  onOpenPalette?: () => void;
  /** Shown only when onConfidenceChange is provided */
  confidence?: ConfidenceLevel | null;
  onConfidenceChange?: (value: ConfidenceLevel | null) => void;
}

export function ExamFooterBar({
  isAnswered,
  isMarkedForReview,
  isFirstQuestion,
  isLastQuestion = false,
  onClearResponse,
  onToggleMarkReview,
  onPrev,
  onNext,
  onSubmitTest,
  isRevealed = false,
  onSubmitAnswer,
  showClearResponse = true,
  showMarkReview = true,
  backgroundColor = 'var(--bg-card)',
  onOpenPalette,
  confidence = null,
  onConfidenceChange,
}: ExamFooterBarProps) {
  const { isMobile, isSmallScreen } = useBreakpoint();
  // On narrow screens the confidence choice gets its own row so Prev/Next stay on screen
  const confidenceOwnRow = Boolean(onConfidenceChange) && isSmallScreen;
  const confidenceSelector = onConfidenceChange ? (
    <ConfidenceSelector
      value={confidence}
      onChange={onConfidenceChange}
      disabled={!isAnswered || isRevealed}
      compact={isMobile}
    />
  ) : null;

  return (
    <footer
      className={`exam-footer-bar${confidenceOwnRow ? ' has-confidence-row' : ''}`}
      style={{
        backgroundColor: backgroundColor,
      }}
    >
      {/* Left Actions: Clear Response & Mark for Review & Palette (on small screens) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
        {/* Mobile Palette Button */}
        {onOpenPalette && isSmallScreen && (
          <button
            type="button"
            onClick={onOpenPalette}
            className="touch-target"
            style={{
              padding: '7px 10px',
              borderRadius: 'var(--radius)',
              border: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              color: 'var(--primary-red)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Open Question Palette"
            aria-label="Open Question Palette"
          >
            <Grid size={14} />
            <span>Review</span>
          </button>
        )}

        {/* Clear Response Button */}
        {showClearResponse && (
          <button
            type="button"
            onClick={onClearResponse}
            disabled={!isAnswered}
            className="touch-target"
            style={{
              padding: isMobile ? '7px 8px' : '8px 14px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${isAnswered ? '#FECACA' : 'var(--border-color)'}`,
              backgroundColor: isAnswered ? '#FEF2F2' : 'var(--bg-card)',
              color: isAnswered ? '#DC2626' : 'var(--text-disabled)',
              fontSize: 12,
              fontWeight: 600,
              cursor: isAnswered ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
            }}
            title="Clear Response"
          >
            <RotateCcw size={13} />
            {!isMobile && <span>Clear</span>}
          </button>
        )}

        {/* Mark for Review Button */}
        {showMarkReview && (
          <button
            type="button"
            onClick={onToggleMarkReview}
            className="touch-target"
            style={{
              padding: isMobile ? '7px 8px' : '8px 14px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${isMarkedForReview ? '#FCD34D' : 'var(--border-color)'}`,
              backgroundColor: isMarkedForReview ? 'var(--status-warning-bg)' : 'var(--bg-card)',
              color: isMarkedForReview ? '#F2B623' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
            }}
            title="Mark for Review"
          >
            <Flag
              size={13}
              fill={isMarkedForReview ? '#F2B623' : 'none'}
              color={isMarkedForReview ? '#F2B623' : 'var(--text-muted)'}
            />
            {!isMobile && <span>{isMarkedForReview ? 'Marked' : 'Mark'}</span>}
          </button>
        )}
      </div>

      {/* Self-reported confidence for the current answer: own top row on narrow screens, centered otherwise */}
      {confidenceOwnRow ? <div className="exam-footer-confidence-row">{confidenceSelector}</div> : confidenceSelector}

      {/* Right Actions: Previous, Submit Answer, & Save Next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
        {/* Submit & Show Solution Button (Guest Mode Per-Question Reveal) */}
        {onSubmitAnswer && (
          <button
            type="button"
            onClick={onSubmitAnswer}
            disabled={!isAnswered}
            className="touch-target"
            style={{
              padding: isMobile ? '7px 10px' : '9px 16px',
              borderRadius: 'var(--radius)',
              border: '1px solid #3A8B53',
              backgroundColor: isAnswered ? '#3A8B53' : '#F0FDF4',
              color: isAnswered ? 'var(--bg-card)' : '#3A8B53',
              fontSize: 'clamp(11.5px, 2vw, 13px)',
              fontWeight: 700,
              cursor: isAnswered ? 'pointer' : 'not-allowed',
              opacity: isAnswered ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: isAnswered ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{isRevealed ? 'Solution ✓' : 'Submit & Show'}</span>
          </button>
        )}

        {/* Previous Button */}
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirstQuestion}
          className="touch-target"
          style={{
            padding: isMobile ? '7px 10px' : '9px 16px',
            borderRadius: 'var(--radius)',
            border: '1px solid #CBD5E1',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            fontSize: 'clamp(12px, 2vw, 13px)',
            fontWeight: 600,
            cursor: isFirstQuestion ? 'not-allowed' : 'pointer',
            opacity: isFirstQuestion ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronLeft size={15} />
          {!isMobile && <span>Prev</span>}
        </button>

        {/* Save & Next Button (Primary Action) or Submit Test on Last Question */}
        {!isLastQuestion ? (
          <button
            type="button"
            onClick={onNext}
            className="touch-target"
            style={{
              padding: isMobile ? '7px 12px' : '9px 20px',
              borderRadius: 'var(--radius)',
              border: 'none',
              backgroundColor: 'var(--primary-red)',
              color: 'var(--bg-card)',
              fontSize: 'clamp(12px, 2vw, 13.5px)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 8px rgba(var(--primary-red-rgb), 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-darker)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-red)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>Next</span>
            <ChevronRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmitTest || onNext}
            className="touch-target"
            style={{
              padding: isMobile ? '7px 12px' : '9px 20px',
              borderRadius: 'var(--radius)',
              border: 'none',
              backgroundColor: '#3A8B53',
              color: 'var(--bg-card)',
              fontSize: 'clamp(12px, 2vw, 13.5px)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3A8B53';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3A8B53';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>Finish</span>
            <ChevronRight size={15} />
          </button>
        )}
      </div>
    </footer>
  );
}
