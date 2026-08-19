import React from 'react';
import { Clock, Shield } from 'lucide-react';

interface ExamHeaderProps {
  examTitle: string;
  paperSubtitle: string;
  timeLeft: number;
  language: 'en' | 'hi';
  isSubmitting?: boolean;
  onLanguageChange: (lang: 'en' | 'hi') => void;
  onSubmitClick: () => void;
}

export function ExamHeader({
  examTitle,
  paperSubtitle,
  timeLeft,
  language,
  isSubmitting = false,
  onLanguageChange,
  onSubmitClick,
}: ExamHeaderProps) {
  const isCriticalTime = timeLeft < 120; // < 2 mins
  const isLowTime = timeLeft < 600; // < 10 mins

  const timerColor = isCriticalTime ? '#FCA5A5' : isLowTime ? '#FDE68A' : '#FFFFFF';

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <header
      style={{
        height: 60,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'linear-gradient(90deg, #0F1D38 0%, #14284C 35%, #1B3864 70%, #224578 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(15, 29, 56, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Left: Admin Theme ExamPlanner Logo & Paper Metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 15,
            flexShrink: 0,
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
          }}
        >
          <Shield size={18} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              {examTitle}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.85)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              CONSOLE
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.65)', fontWeight: 500, lineHeight: 1.2, marginTop: 2 }}>
            {paperSubtitle}
          </div>
        </div>
      </div>

      {/* Center: Monospaced Precision Clock Module */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 18px',
          borderRadius: 6,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.15)',
        }}
      >
        <Clock size={15} color={timerColor} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 9,
              color: 'rgba(255, 255, 255, 0.55)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            TIME REMAINING
          </span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: timerColor,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.04em',
              marginTop: 2,
            }}
          >
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Right: Submit Test CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

        {/* Submit Test Button */}
        <button
          type="button"
          onClick={onSubmitClick}
          disabled={isSubmitting}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            backgroundColor: 'rgba(255, 255, 255, 0.09)',
            color: '#FFFFFF',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)';
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Test'}
        </button>
      </div>
    </header>
  );
}
