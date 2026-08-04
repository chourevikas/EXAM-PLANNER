import React from 'react';
import { Ico } from '../common/Icons';

export function WhySection() {
  const cols = [
    {
      icon: <Ico.Brain />,
      title: 'Smarter Than MCQ Platforms',
      pts: [
        'AI-driven adaptive recommendations',
        'Behavioral performance analysis',
        'Subject-level mastery tracking',
      ],
    },
    {
      icon: <Ico.Chart />,
      title: 'Data-Driven Preparation',
      pts: [
        'Visual accuracy trend dashboards',
        'AI-computed exam-readiness score',
        'Granular time management insights',
      ],
    },
    {
      icon: <Ico.Cal />,
      title: 'Fully Personalized',
      pts: [
        'Custom spaced-repetition scheduling',
        'Goal-aligned daily study plans',
        'Personalized revision priority queues',
      ],
    },
  ];

  return (
    <section
      id="about"
      style={{
        padding: '104px 0',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-color)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 52px' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            Why PrepAI
          </div>
          <h2
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-1px',
              marginBottom: 16,
            }}
          >
            Built Different, by Design
          </h2>
          <p
            style={{
              fontSize: 17,
              color: 'var(--text-muted)',
              maxWidth: 500,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Not a generic coaching platform. A precision instrument built for
            serious UPSC aspirants.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 28,
          }}
        >
          {cols.map((col, i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-body)',
                border: '1.5px solid var(--border-color)',
                borderRadius: 18,
                padding: 36,
                transition: 'all 0.3s ease',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--blue50)',
                  border: '1px solid var(--blue100)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--royal)',
                  marginBottom: 20,
                }}
              >
                {col.icon}
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: 20,
                }}
              >
                {col.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {col.pts.map((p) => (
                  <div
                    key={p}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--emerald)',
                        marginTop: 2,
                        flexShrink: 0,
                      }}
                    >
                      <Ico.Check size={14} />
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: 'var(--text-main)',
                        lineHeight: 1.55,
                      }}
                    >
                      {p}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
