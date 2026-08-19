import React from 'react';
import { Zap, Clock } from 'lucide-react';

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
  const isLowTime = timeLeft < 600; // < 10 mins

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <header
      style={{
        height: 64,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: '#0f1e3c',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 24px',
        boxSizing: 'border-box'
      }}
    >
      {/* Left: Logo & Exam Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
            flexShrink: 0
          }}
        >
          <Zap size={18} color="#fff" fill="#fff" />
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.01em',
              fontFamily: 'var(--font-display)'
            }}
          >
            {examTitle}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.55)', fontWeight: 500 }}>
            {paperSubtitle}
          </div>
        </div>
      </div>

      {/* Center: Live Timer Widget */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 16px',
          borderRadius: 20,
          backgroundColor: isLowTime ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          border: `1px solid ${isLowTime ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.3)'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Clock size={16} color={isLowTime ? '#ef4444' : '#60a5fa'} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span
            style={{
              fontSize: 10,
              color: isLowTime ? '#ef4444' : 'rgba(255, 255, 255, 0.6)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 700
            }}
          >
            Time Remaining
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: isLowTime ? '#ef4444' : '#ffffff',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.05em'
            }}
          >
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Right: Language Switcher & Submit CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        
        {/* Language Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            padding: 3,
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <button
            onClick={() => onLanguageChange('en')}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: language === 'en' ? '#2563eb' : 'transparent',
              color: language === 'en' ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            English
          </button>
          <button
            onClick={() => onLanguageChange('hi')}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: language === 'hi' ? '#2563eb' : 'transparent',
              color: language === 'hi' ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            हिंदी
          </button>
        </div>

        {/* Submit Test Button */}
        <button
          onClick={onSubmitClick}
          disabled={isSubmitting}
          style={{
            padding: '8px 18px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
            transition: 'transform 0.2s'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Test'}
        </button>
      </div>
    </header>
  );
}
