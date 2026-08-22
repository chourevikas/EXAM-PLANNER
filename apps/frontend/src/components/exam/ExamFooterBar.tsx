import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Flag } from 'lucide-react';

interface ExamFooterBarProps {
  isAnswered: boolean;
  isMarkedForReview: boolean;
  isFirstQuestion: boolean;
  isLastQuestion?: boolean;
  onClearResponse: () => void;
  onToggleMarkReview: () => void;
  onPrev: () => void;
  onNext: () => void;
  isRevealed?: boolean;
  onSubmitAnswer?: () => void;
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
  isRevealed = false,
  onSubmitAnswer,
}: ExamFooterBarProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <footer
      style={{
        height: 64,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        boxShadow: '0 -2px 10px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 28px',
        boxSizing: 'border-box',
      }}
    >
      {/* Left Actions: Clear Response & Mark for Review */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10 }}>
        {/* Clear Response Button */}
        <button
          type="button"
          onClick={onClearResponse}
          disabled={!isAnswered}
          style={{
            padding: isMobile ? '7px 10px' : '8px 16px',
            borderRadius: 6,
            border: `1px solid ${isAnswered ? '#FECACA' : '#E2E8F0'}`,
            backgroundColor: isAnswered ? '#FEF2F2' : '#FFFFFF',
            color: isAnswered ? '#DC2626' : '#94A3B8',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: isAnswered ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
          title="Clear Response"
        >
          <RotateCcw size={14} />
          <span>Clear Response</span>
        </button>

        {/* Mark for Review Button */}
        <button
          type="button"
          onClick={onToggleMarkReview}
          style={{
            padding: isMobile ? '7px 10px' : '8px 16px',
            borderRadius: 6,
            border: `1px solid ${isMarkedForReview ? '#FCD34D' : '#E2E8F0'}`,
            backgroundColor: isMarkedForReview ? '#FEF3C7' : '#FFFFFF',
            color: isMarkedForReview ? '#D97706' : '#475569',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
          title="Mark for Review"
        >
          <Flag size={14} fill={isMarkedForReview ? '#D97706' : 'none'} color={isMarkedForReview ? '#D97706' : '#64748B'} />
          <span>{isMarkedForReview ? 'Marked for Review' : 'Mark for Review'}</span>
        </button>
      </div>

      {/* Right Actions: Previous, Submit Answer, & Save Next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10 }}>
        {/* Submit & Show Solution Button (Guest Mode Per-Question Reveal) */}
        {onSubmitAnswer && (
          <button
            type="button"
            onClick={onSubmitAnswer}
            disabled={!isAnswered}
            style={{
              padding: isMobile ? '7px 12px' : '9px 18px',
              borderRadius: 6,
              border: '1px solid #10B981',
              backgroundColor: isAnswered ? '#10B981' : '#F0FDF4',
              color: isAnswered ? '#FFFFFF' : '#059669',
              fontSize: 13,
              fontWeight: 700,
              cursor: isAnswered ? 'pointer' : 'not-allowed',
              opacity: isAnswered ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: isAnswered ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{isRevealed ? 'Solution Revealed ✓' : 'Submit & Show Solution'}</span>
          </button>
        )}

        {/* Previous Button (Outline/Subtle) */}
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirstQuestion}
          style={{
            padding: isMobile ? '7px 12px' : '9px 18px',
            borderRadius: 6,
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            color: '#475569',
            fontSize: 13,
            fontWeight: 600,
            cursor: isFirstQuestion ? 'not-allowed' : 'pointer',
            opacity: isFirstQuestion ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>

        {/* Save & Next Button (Primary Action) */}
        {!isLastQuestion && (
          <button
            type="button"
            onClick={onNext}
            style={{
              padding: isMobile ? '7px 14px' : '9px 22px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1D4ED8';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2563EB';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </footer>
  );
}
