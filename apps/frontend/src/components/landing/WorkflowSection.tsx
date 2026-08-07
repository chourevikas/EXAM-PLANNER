import React from 'react';
import { Ico } from '../common/Icons';

const stepColors = [
  { color: '#3b82f6', bg: 'rgba(59,130,246,0.18)',  border: '#3b82f6' },
  { color: '#10b981', bg: 'rgba(16,185,129,0.18)', border: '#10b981' },
  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.22)', border: '#8b5cf6' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.18)', border: '#f59e0b' },
  { color: '#ec4899', bg: 'rgba(236,72,153,0.18)', border: '#ec4899' },
];

export function WorkflowSection() {
  const steps = [
    { n: 1, icon: <Ico.Book />,    title: 'Solve PYQs',       desc: '10,000+ curated questions across all subjects and years.' },
    { n: 2, icon: <Ico.Brain />,   title: 'AI Analyses',      desc: 'Your response patterns mapped to knowledge gaps in real-time.' },
    { n: 3, icon: <Ico.Target />,  title: 'Find Weak Areas',  desc: 'Precise identification of subtopics draining your score.' },
    { n: 4, icon: <Ico.Cal />,     title: 'Build Study Plan', desc: 'AI-generated daily plan calibrated to your target exam date.' },
    { n: 5, icon: <Ico.Trend />,   title: 'Improve & Crack',  desc: 'Track measurable accuracy gains as confidence compounds.' },
  ];

  return (
    <section
      id="how-it-works"
      className="landing-section-padding"
      style={{
        background: 'linear-gradient(160deg, #0f1e3c 0%, #07112a 60%, #111827 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: '10%',
          width: 600,
          height: 400,
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="landing-container" style={{ position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '1.2px',
              textTransform: 'uppercase' as const,
              color: '#60a5fa',
              marginBottom: 12,
              fontFamily: 'var(--font-mono)',
            }}
          >
            Intelligent Workflow
          </div>
          <h2
            className="section-heading"
            style={{ fontWeight: 800, color: '#F8FAFC', marginBottom: 16 }}
          >
            How PrepAI Works
          </h2>
          <p
            className="section-subheading"
            style={{ color: '#94A3B8', maxWidth: 480, margin: '0 auto' }}
          >
            Five precision steps from your first session to exam-day readiness.
          </p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:flex" style={{ alignItems: 'flex-start', position: 'relative' }}>
          {steps.map((s, i) => {
            const palette = stepColors[i];
            return (
              <div
                key={s.n}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  position: 'relative',
                }}
              >
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 36,
                      left: '50%',
                      right: '-50%',
                      height: 1,
                      background: 'rgba(255,255,255,0.08)',
                      zIndex: 0,
                    }}
                  />
                )}

                {/* Step circle */}
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    position: 'relative',
                    zIndex: 1,
                    background: palette.bg,
                    border: `2px solid ${palette.border}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: palette.color,
                    boxShadow: `0 0 24px ${palette.color}25`,
                    marginBottom: 24,
                    transition: 'all 0.25s ease',
                  }}
                >
                  {s.icon}
                </div>

                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: palette.color,
                    letterSpacing: '1px',
                    marginBottom: 6,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  STEP {s.n}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#F8FAFC',
                    marginBottom: 8,
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#94A3B8',
                    lineHeight: 1.65,
                    maxWidth: 155,
                  }}
                >
                  {s.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Vertical Layout */}
        <div className="flex flex-col lg:hidden gap-4">
          {steps.map((s, i) => {
            const palette = stepColors[i];
            return (
              <div
                key={s.n}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  padding: '20px 24px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: palette.bg,
                    border: `2px solid ${palette.border}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: palette.color,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: palette.color,
                      letterSpacing: '1px',
                      marginBottom: 2,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    STEP {s.n}
                  </div>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}
                  >
                    {s.title}
                  </div>
                  <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
