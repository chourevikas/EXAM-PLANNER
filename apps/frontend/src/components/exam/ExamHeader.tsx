import React from 'react';
import { Clock, Shield, ArrowLeft, ChevronRight } from 'lucide-react';

interface ExamHeaderProps {
  examTitle: string;
  paperSubtitle: string;
  timeLeft: number;
  language: 'en' | 'hi';
  isSubmitting?: boolean;
  showSubmitButton?: boolean;
  showTimer?: boolean;
  topicName?: string;
  subtopicName?: string;
  parentBreadcrumb?: string;
  onBack?: () => void;
  onLanguageChange: (lang: 'en' | 'hi') => void;
  onSubmitClick?: () => void;
}

export function ExamHeader({
  examTitle,
  paperSubtitle,
  timeLeft,
  language,
  isSubmitting = false,
  showSubmitButton = true,
  showTimer = true,
  topicName,
  subtopicName,
  parentBreadcrumb,
  onBack,
  onLanguageChange,
  onSubmitClick,
}: ExamHeaderProps) {
  const isAuth = !!(localStorage.getItem('access_token') && localStorage.getItem('user'));
  const rootBreadcrumb = parentBreadcrumb || (isAuth ? 'Student Dashboard' : 'Home');

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
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(15, 29, 56, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 24px',
        boxSizing: 'border-box',
        fontFamily: "'IBM Plex Sans', -apple-system, system-ui, sans-serif",
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
            fontWeight: 700,
            fontSize: 15,
            flexShrink: 0,
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
          }}
        >
          <Shield size={18} color="#FFFFFF" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Neat Fading Breadcrumb Trail (IBM Plex Sans 600 Page title / 500 Subtitle) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'rgba(255, 255, 255, 0.75)', fontWeight: 500, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'rgba(255, 255, 255, 0.95)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
                fontFamily: "'IBM Plex Sans', sans-serif",
                textDecoration: 'none',
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              title={`Return to ${rootBreadcrumb}`}
            >
              {rootBreadcrumb}
            </button>

            {topicName && (
              <>
                <ChevronRight size={13} color="rgba(255, 255, 255, 0.35)" />
                <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>{topicName}</span>
              </>
            )}

            {subtopicName && subtopicName !== 'Choose Subtopic' && subtopicName !== topicName && (
              <>
                <ChevronRight size={13} color="rgba(255, 255, 255, 0.35)" />
                <span style={{ color: '#93C5FD', fontWeight: 600 }}>{subtopicName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center: Monospaced Precision Clock Module with Admin Theme Fading Ring */}
      {showTimer && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '5px 22px',
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.07)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.25), 0 4px 14px rgba(15, 29, 56, 0.3)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <Clock size={16} color={timerColor} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 8.5,
                color: 'rgba(255, 255, 255, 0.55)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              TIME REMAINING
            </span>
            <span
              style={{
                fontSize: 16.5,
                fontWeight: 800,
                color: timerColor,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.05em',
                marginTop: 2,
              }}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      )}

      {/* Right: Submit Test CTA (Only when showSubmitButton is true) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {showSubmitButton && onSubmitClick && (
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
        )}
      </div>
    </header>
  );
}
