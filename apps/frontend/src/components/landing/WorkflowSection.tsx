import React from 'react';
import { Ico } from '../common/Icons';

export function WorkflowSection() {
  const steps = [
    {
      n: 1,
      icon: <Ico.Book />,
      title: 'Solve PYQs',
      desc: '10,000+ curated questions across all UPSC subjects and years.',
    },
    {
      n: 2,
      icon: <Ico.Brain />,
      title: 'AI Analyses',
      desc: 'Your response patterns mapped to knowledge gaps in real-time.',
    },
    {
      n: 3,
      icon: <Ico.Target />,
      title: 'Find Weak Areas',
      desc: 'Precise identification of the subtopics draining your score.',
    },
    {
      n: 4,
      icon: <Ico.Cal />,
      title: 'Build Study Plan',
      desc: 'AI-generated daily plan calibrated to your target exam date.',
    },
    {
      n: 5,
      icon: <Ico.Trend />,
      title: 'Improve & Crack',
      desc: 'Track measurable accuracy gains as confidence compounds.',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="landing-section-padding"
      style={{
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <div className="landing-container">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            Intelligent Workflow
          </div>
          <h2
            className="section-heading"
            style={{
              fontWeight: 800,
              color: 'var(--text-main)',
              marginBottom: 16,
            }}
          >
            How PrepAI Works
          </h2>
          <p
            className="section-subheading"
            style={{
              color: 'var(--text-muted)',
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            Five precision steps from your first session to exam-day readiness.
          </p>
        </div>

        {/* Desktop Layout (horizontal 5 steps) */}
        <div
          className="hidden lg:flex"
          style={{
            alignItems: 'flex-start',
            position: 'relative',
          }}
        >
          {steps.map((s, i) => (
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
              {/* connector */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 35,
                    left: '50%',
                    right: '-50%',
                    height: 1,
                    background: 'var(--border-color)',
                    zIndex: 0,
                  }}
                />
              )}
              {/* circle */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  position: 'relative',
                  zIndex: 1,
                  background:
                    i === 2
                      ? 'linear-gradient(135deg, var(--royal), #1D4ED8)'
                      : 'var(--bg-card)',
                  border: `2px solid ${i === 2 ? 'var(--royal)' : 'var(--border-color)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: i === 2 ? '#ffffff' : 'var(--royal)',
                  boxShadow:
                    i === 2
                      ? '0 12px 32px rgba(37,99,235,0.35)'
                      : 'var(--shadow-sm)',
                  marginBottom: 24,
                  transition: 'all 0.2s',
                }}
              >
                {s.icon}
                {i === 2 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: -6,
                      borderRadius: '50%',
                      border: '1px dashed rgba(37,99,235,0.4)',
                      animation: 'spin-slow 18s linear infinite',
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'var(--royal)',
                  letterSpacing: '1px',
                  marginBottom: 6,
                }}
              >
                STEP {s.n}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: 8,
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  lineHeight: 1.65,
                  maxWidth: 155,
                }}
              >
                {s.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile & Tablet Vertical Timeline Layout */}
        <div className="flex flex-col lg:hidden gap-6">
          {steps.map((s, i) => (
            <div
              key={s.n}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                padding: 20,
                borderRadius: 16,
                background: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background:
                    i === 2
                      ? 'linear-gradient(135deg, var(--royal), #1D4ED8)'
                      : 'var(--bg-card)',
                  border: `2px solid ${i === 2 ? 'var(--royal)' : 'var(--border-color)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: i === 2 ? '#ffffff' : 'var(--royal)',
                }}
              >
                {s.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--royal)',
                    letterSpacing: '1px',
                    marginBottom: 2,
                  }}
                >
                  STEP {s.n}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    marginBottom: 4,
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--text-muted)',
                    lineHeight: 1.6,
                  }}
                >
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

