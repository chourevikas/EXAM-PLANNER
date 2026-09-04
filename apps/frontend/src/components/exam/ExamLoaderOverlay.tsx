import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, ShieldCheck } from 'lucide-react';

interface ExamLoaderOverlayProps {
  title?: string;
  subtitle?: string;
  isFullScreen?: boolean;
}

const LOADING_STEPS = [
  'Fetching PYQ question database...',
  'Structuring exam sections & metadata...',
  'Initializing timed workspace & timer...',
  'Finalizing mock examination console...',
];

export function ExamLoaderOverlay({
  title = 'ExamPlanner Mock Console',
  subtitle = 'Setting up your authentic examination environment',
  isFullScreen = true,
}: ExamLoaderOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const content = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 24px',
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
        textAlign: 'center',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Ambient Pulsating Radar Icon Container */}
      <div
        style={{
          position: 'relative',
          width: 96,
          height: 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
        }}
      >
        {/* Outer Ring Pulse 1 */}
        <div
          style={{
            position: 'absolute',
            inset: -12,
            borderRadius: 0,
            backgroundColor: 'rgba(227, 27, 35, 0.12)',
            animation: 'loaderPulse 2.4s ease-in-out infinite',
          }}
        />
        {/* Outer Ring Pulse 2 */}
        <div
          style={{
            position: 'absolute',
            inset: -24,
            borderRadius: 0,
            backgroundColor: 'rgba(227, 27, 35, 0.06)',
            animation: 'loaderPulse 2.4s ease-in-out infinite 0.8s',
          }}
        />

        {/* Center Glowing Icon Badge */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 0,
            backgroundColor: '#E31B23',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 30px rgba(227, 27, 35, 0.35)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <BookOpen size={32} strokeWidth={2.2} />
        </div>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#172033',
          margin: '0 0 6px 0',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 13.5,
          color: '#64748B',
          margin: '0 0 24px 0',
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>

      {/* Shimmer Progress Line */}
      <div
        style={{
          width: 240,
          height: 4,
          backgroundColor: '#E2E8F0',
          borderRadius: 0,
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '60%',
            background: 'linear-gradient(90deg, #E31B23 0%, #E31B23 100%)',
            borderRadius: 0,
            animation: 'loaderProgress 1.6s ease-in-out infinite',
          }}
        />
      </div>

      {/* Dynamic Cycling Step Text */}
      {/* <div
        style={{
          minHeight: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          fontSize: 13,
          fontWeight: 600,
          color: '#E31B23',
          transition: 'all 0.3s ease',
        }}
      >
        <Sparkles size={14} className="animate-spin-slow" />
        <span>{LOADING_STEPS[stepIndex]}</span>
      </div> */}

      {/* Trust Badge Subtext */}
      {/* <div
        style={{
          marginTop: 24,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11.5,
          color: '#94A3B8',
          fontWeight: 500,
        }}
      >
        <ShieldCheck size={13} style={{ color: '#3A8B53' }} />
        <span>Official Exam Engine & Verified Answer Key</span>
      </div> */}

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes loaderPulse {
          0%, 100% {
            transform: scale(0.92);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }
        @keyframes loaderProgress {
          0% {
            left: -60%;
          }
          100% {
            left: 100%;
          }
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (!isFullScreen) {
    return content;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {content}
    </div>
  );
}
