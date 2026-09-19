import React from 'react';
import { Clock, ChevronRight, Focus, Minimize2, SlidersHorizontal, Lightbulb, Globe } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { SUPPORTED_LANGUAGES } from '../../constants/languages';

interface ExamHeaderProps {
  examTitle: string;
  paperSubtitle: string;
  timeLeft: number;
  language: string;
  isSubmitting?: boolean;
  showSubmitButton?: boolean;
  showTimer?: boolean;
  topicName?: string;
  subtopicName?: string;
  parentBreadcrumb?: string;
  onBack?: () => void;
  onLanguageChange: (lang: string) => void;
  onSubmitClick?: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  onFilterClick?: () => void;
  onRecsClick?: () => void;
  recsCount?: number;
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
  focusMode = false,
  onToggleFocusMode,
  onFilterClick,
  onRecsClick,
  recsCount,
}: ExamHeaderProps) {
  const isAuth = !!(localStorage.getItem('access_token') && localStorage.getItem('user'));
  const rootBreadcrumb = parentBreadcrumb || (isAuth ? 'Dashboard' : 'Home');
  const { isMobile, isTabletOrBelow } = useBreakpoint();

  const isCriticalTime = timeLeft < 120; // < 2 mins
  const isLowTime = timeLeft < 600; // < 10 mins

  const timerColor = isCriticalTime ? 'var(--primary-red-border)' : isLowTime ? '#FDE68A' : 'var(--bg-card)';

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <header
      className="exam-top-header"
      style={{
        height: 60,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'linear-gradient(90deg, #111111 0%, #172033 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(15, 29, 56, 0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 clamp(12px, 3vw, 24px)',
        boxSizing: 'border-box',
        fontFamily: "'IBM Plex Sans', -apple-system, system-ui, sans-serif",
      }}
    >
      {/* Left: Brand Logo & Paper Metadata */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 1.5vw, 12px)',
          minWidth: 0,
          flex: 1,
        }}
      >
        <img
          src="/logo.jpeg"
          alt="ExamPlanner"
          style={{
            width: 32,
            height: 32,
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />

        {!isTabletOrBelow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            {/* Breadcrumb Trail */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'clamp(12px, 2.5vw, 14px)',
                color: 'rgba(255, 255, 255, 0.75)',
                fontWeight: 500,
                fontFamily: "'IBM Plex Sans', sans-serif",
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <button
                type="button"
                onClick={onBack}
                className="touch-target"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'rgba(255, 255, 255, 0.95)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 'inherit',
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
                  <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                    {topicName}
                  </span>
                </>
              )}

              {subtopicName && subtopicName !== 'Choose Subtopic' && subtopicName !== topicName && (
                <>
                  <ChevronRight size={13} color="rgba(255, 255, 255, 0.35)" />
                  <span style={{ color: 'var(--primary-red)', fontWeight: 600 }}>{subtopicName}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Center: Precision Clock Module */}
      {showTimer && (
        <div
          className="exam-timer-center"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.07)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.25), 0 4px 14px rgba(15, 29, 56, 0.3)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            padding: '4px 10px',
          }}
        >
          <Clock size={14} color={timerColor} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {!isTabletOrBelow && (
              <span
                style={{
                  fontSize: 8,
                  color: 'rgba(255, 255, 255, 0.55)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                TIME REMAINING
              </span>
            )}
            <span
              style={{
                fontSize: 'clamp(13px, 2.5vw, 15.5px)',
                fontWeight: 800,
                color: timerColor,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.04em',
              }}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      )}

      {/* Right: Controls & Language Selector & Submit CTA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 1.2vw, 10px)',
          flex: 1,
          justifyContent: 'flex-end',
          minWidth: 0,
        }}
      >
        {/* Language Selector Dropdown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            padding: '4px 8px',
            color: 'var(--bg-card)',
            flexShrink: 0,
            transition: 'border-color 0.2s ease',
          }}
          title="Select Exam Language"
        >
          <Globe size={14} style={{ color: '#60A5FA', flexShrink: 0 }} />
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--bg-card)',
              fontSize: 'clamp(11px, 2vw, 12.5px)',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              fontFamily: "'IBM Plex Sans', sans-serif",
              maxWidth: isMobile ? 80 : 130,
            }}
            aria-label="Select exam language"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option
                key={lang.code}
                value={lang.code}
                style={{ background: 'var(--deep-navy)', color: 'var(--bg-card)' }}
              >
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>
        {isTabletOrBelow && onFilterClick && (
          <button
            type="button"
            onClick={onFilterClick}
            className="touch-target"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              backgroundColor: 'rgba(255, 255, 255, 0.09)',
              color: 'var(--bg-card)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            title="Filters"
            aria-label="Show filters"
          >
            <SlidersHorizontal size={15} />
          </button>
        )}
        {isTabletOrBelow && onRecsClick && (
          <button
            type="button"
            onClick={onRecsClick}
            className="touch-target"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              width: recsCount ? 'auto' : 32,
              height: 32,
              padding: recsCount ? '0 8px' : 0,
              borderRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              backgroundColor: 'rgba(255, 255, 255, 0.09)',
              color: 'var(--bg-card)',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: 11.5,
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
            title="Recommended Questions"
            aria-label="Show recommended questions"
          >
            <Lightbulb size={15} />
            {!!recsCount && <span>{recsCount}</span>}
          </button>
        )}
        {onToggleFocusMode && (
          <button
            type="button"
            onClick={onToggleFocusMode}
            className="touch-target"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 0,
              border: `1px solid ${focusMode ? 'rgba(var(--primary-red-rgb), 0.5)' : 'rgba(255, 255, 255, 0.25)'}`,
              backgroundColor: focusMode ? 'rgba(var(--primary-red-rgb), 0.18)' : 'rgba(255, 255, 255, 0.09)',
              color: 'var(--bg-card)',
              fontSize: 'clamp(11.5px, 2.5vw, 12.5px)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            title={focusMode ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {focusMode ? <Minimize2 size={13} /> : <Focus size={13} />}
            {!isTabletOrBelow && <span>{focusMode ? 'Exit Focus' : 'Full Screen'}</span>}
          </button>
        )}
        {showSubmitButton && onSubmitClick && (
          <button
            type="button"
            onClick={onSubmitClick}
            disabled={isSubmitting}
            className="touch-target"
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              backgroundColor: 'rgba(255, 255, 255, 0.09)',
              color: 'var(--bg-card)',
              fontSize: 'clamp(11.5px, 2.5vw, 12.5px)',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting)
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting)
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)';
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Test'}
          </button>
        )}
      </div>
    </header>
  );
}
