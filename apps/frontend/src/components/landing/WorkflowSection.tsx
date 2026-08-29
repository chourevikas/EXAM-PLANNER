import React from 'react';
import { Ico } from '../common/Icons';

const stepColors = [
  { color: '#E31B23', bg: 'rgba(227,27,35,0.18)',  border: '#E31B23' },
  { color: '#3A8B53', bg: 'rgba(58,139,83,0.18)', border: '#3A8B53' },
  { color: '#199EAE', bg: 'rgba(25,158,174,0.22)', border: '#199EAE' },
  { color: '#F2B623', bg: 'rgba(242,182,35,0.18)', border: '#F2B623' },
  { color: '#F47B35', bg: 'rgba(244,123,53,0.18)', border: '#F47B35' },
];

export function WorkflowSection() {
  const steps = [
    { n: 1, icon: <Ico.Book />,    title: 'Solve PYQs',                  desc: '10,000+ curated questions across all subjects and years.' },
    { n: 2, icon: <Ico.Brain />,   title: 'Real-Time Pattern Analysis', desc: 'Your response patterns mapped to knowledge gaps in real-time.' },
    { n: 3, icon: <Ico.Target />,  title: 'Find Weak Areas',             desc: 'Precise identification of subtopics draining your score.' },
    { n: 4, icon: <Ico.Cal />,     title: 'Build Study Plan',            desc: 'Adaptive daily plan calibrated to your target exam date.' },
    { n: 5, icon: <Ico.Trend />,   title: 'Improve & Crack',             desc: 'Track measurable accuracy gains as confidence compounds.' },
  ];

  return (
    <section
      id="how-it-works"
      className="landing-section-padding"
      style={{
        background: '#172033',
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
            How the Adaptive Platform Works
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
                    borderRadius: 0,
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
                  borderRadius: 0,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 0,
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
