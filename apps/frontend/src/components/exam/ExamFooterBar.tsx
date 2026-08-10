import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Flag } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ExamFooterBarProps {
  isAnswered: boolean;
  isMarkedForReview: boolean;
  isFirstQuestion: boolean;
  onClearResponse: () => void;
  onToggleMarkReview: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function ExamFooterBar({
  isAnswered,
  isMarkedForReview,
  isFirstQuestion,
  onClearResponse,
  onToggleMarkReview,
  onPrev,
  onNext,
}: ExamFooterBarProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <footer
      style={{
        height: 70,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: isDark ? '#0f1e3c' : '#ffffff',
        borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        boxShadow: isDark ? '0 -4px 20px rgba(0,0,0,0.25)' : '0 -2px 10px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 32px',
        boxSizing: 'border-box',
        transition: 'background-color 0.2s, border-color 0.2s'
      }}
    >
      {/* Left Actions: Clear & Mark for Review */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12 }}>
        <button
          onClick={onClearResponse}
          disabled={!isAnswered}
          style={{
            padding: isMobile ? '8px 10px' : '9px 16px',
            borderRadius: 10,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f8fafc',
            color: isAnswered ? '#ef4444' : (isDark ? 'rgba(255, 255, 255, 0.4)' : '#94a3b8'),
            fontSize: 12,
            fontWeight: 600,
            cursor: isAnswered ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
          title="Clear Response"
        >
          <RotateCcw size={15} />
          {!isMobile && <span>Clear Response</span>}
        </button>

        <button
          onClick={onToggleMarkReview}
          style={{
            padding: isMobile ? '8px 10px' : '9px 16px',
            borderRadius: 10,
            border: isMarkedForReview ? '1px solid #f59e0b' : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
            backgroundColor: isMarkedForReview
              ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#fffbe0')
              : (isDark ? 'rgba(255, 255, 255, 0.06)' : '#f8fafc'),
            color: isMarkedForReview ? '#d97706' : (isDark ? '#ffffff' : '#0f172a'),
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
          title="Mark for Review"
        >
          <Flag size={15} />
          <span>{isMarkedForReview ? 'Marked' : (isMobile ? 'Review' : 'Mark for Review')}</span>
        </button>
      </div>

      {/* Right Actions: Previous & Save Next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 12 }}>
        <button
          onClick={onPrev}
          disabled={isFirstQuestion}
          style={{
            padding: isMobile ? '8px 12px' : '10px 18px',
            borderRadius: 10,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f8fafc',
            color: isDark ? '#ffffff' : '#0f172a',
            fontSize: 12,
            fontWeight: 600,
            cursor: isFirstQuestion ? 'not-allowed' : 'pointer',
            opacity: isFirstQuestion ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <ChevronLeft size={16} />
          {!isMobile && <span>Previous</span>}
        </button>

        <button
          onClick={onNext}
          style={{
            padding: isMobile ? '8px 14px' : '10px 22px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
          }}
        >
          <span>{isMobile ? 'Next' : 'Save & Next'}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </footer>
  );
}
