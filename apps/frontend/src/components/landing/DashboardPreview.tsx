import React from 'react';
import { C } from '../../constants/theme';

export function DashboardPreview() {
  return (
    <section
      style={{
        padding: '104px 0',
        background: C.navy,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `linear-gradient(${C.slate400} 1px,transparent 1px),linear-gradient(90deg,${C.slate400} 1px,transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      {/* glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 700,
          height: 400,
          background:
            'radial-gradient(ellipse,rgba(37,99,235,0.13) 0%,transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '0 52px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div
            className="section-label"
            style={{ justifyContent: 'center', color: C.elec }}
          >
            Live Preview
          </div>
          <h2
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-1px',
              marginBottom: 16,
            }}
          >
            Your Dashboard, Data-Driven & Personal
          </h2>
          <p
            style={{
              fontSize: 17,
              color: C.slate400,
              maxWidth: 480,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Every insight you need to prepare smarter — organized in one
            intelligent, calm interface.
          </p>
        </div>

        {/* Laptop */}
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div
            style={{
              background: C.slate800,
              borderRadius: '22px 22px 0 0',
              padding: '14px 14px 0',
              boxShadow: '0 60px 140px rgba(0,0,0,0.55)',
              border: `1px solid ${C.slate700}`,
            }}
          >
            {/* browser bar */}
            <div
              style={{
                background: '#0F1A2E',
                borderRadius: '10px 10px 0 0',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: `1px solid ${C.slate800}`,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                {['#FF5F57', '#FFBD2E', '#28C840'].map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: c,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  flex: 1,
                  background: C.slate800,
                  borderRadius: 6,
                  padding: '4px 12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: C.slate600 }}>
                  app.examplanner.in/dashboard
                </span>
              </div>
            </div>

            {/* content */}
            <div style={{ background: '#F8FAFC', padding: 24 }}>
              {/* stat row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4,1fr)',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {[
                  {
                    l: 'Total Questions',
                    v: '4,287',
                    d: '+142 this week',
                    c: C.royal,
                  },
                  {
                    l: 'Accuracy Rate',
                    v: '78.4%',
                    d: '+4.2% improved',
                    c: C.emerald,
                  },
                  {
                    l: 'Study Streak',
                    v: '14 Days',
                    d: 'Personal best 🔥',
                    c: C.saffron,
                  },
                  {
                    l: 'Smart Insights',
                    v: '89 Tips',
                    d: 'Personalized',
                    c: '#8B5CF6',
                  },
                ].map((s) => (
                  <div
                    key={s.l}
                    style={{
                      background: '#fff',
                      borderRadius: 12,
                      padding: '14px 16px',
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: C.muted,
                        fontWeight: 600,
                        marginBottom: 4,
                        letterSpacing: '0.3px',
                      }}
                    >
                      {s.l}
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color: s.c,
                        marginBottom: 2,
                      }}
                    >
                      {s.v}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.emerald,
                        fontWeight: 500,
                      }}
                    >
                      {s.d}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gap: 16,
                }}
              >
                {/* subject bars */}
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    padding: '18px 20px',
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.slate,
                      marginBottom: 16,
                    }}
                  >
                    Accuracy by Subject
                  </div>
                  {[
                    { name: 'Indian Polity', pct: 84, c: C.emerald },
                    { name: 'History', pct: 42, c: C.saffron },
                    { name: 'Geography', pct: 79, c: C.royal },
                    { name: 'Economy', pct: 58, c: '#8B5CF6' },
                    { name: 'Sci & Tech', pct: 91, c: C.emerald },
                    { name: 'Environment', pct: 65, c: '#06B6D4' },
                  ].map((s) => (
                    <div
                      key={s.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 9,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: C.grey,
                          width: 96,
                          flexShrink: 0,
                        }}
                      >
                        {s.name}
                      </div>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${s.pct}%`,
                            background: s.c,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: C.slate,
                          width: 28,
                          textAlign: 'right',
                        }}
                      >
                        {s.pct}%
                      </div>
                    </div>
                  ))}
                </div>

                {/* right panel */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      padding: '16px',
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.slate,
                        marginBottom: 10,
                      }}
                    >
                      Smart Recommendation
                    </div>
                    <div
                      style={{
                        background: `rgba(37,99,235,0.06)`,
                        border: `1px solid rgba(37,99,235,0.15)`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 12,
                        color: '#1d4ed8',
                        lineHeight: 1.55,
                      }}
                    >
                      Focus on Modern History — 42% accuracy, 28 targeted PYQs
                      queued for you.
                    </div>
                  </div>
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      padding: '16px',
                      border: `1px solid ${C.border}`,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.slate,
                        marginBottom: 12,
                      }}
                    >
                      Today's Sessions
                    </div>
                    {[
                      ['Polity', '30', C.emerald],
                      ['History', '15', C.saffron],
                      ['Economy', '20', C.royal],
                    ].map(([l, n, c]) => (
                      <div
                        key={l}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 12, color: C.grey }}>
                          {l}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: c,
                            background: `rgba(${
                              c === C.emerald
                                ? '16,185,129'
                                : c === C.saffron
                                ? '249,115,22'
                                : '37,99,235'
                            },0.1)`,
                            padding: '2px 8px',
                            borderRadius: 99,
                          }}
                        >
                          {n} Qs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* base */}
          <div
            style={{
              height: 14,
              background: C.slate800,
              borderRadius: '0 0 8px 8px',
              margin: '0 28px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
            }}
          />
          <div
            style={{
              height: 6,
              background: C.slate700,
              borderRadius: '0 0 14px 14px',
              margin: '0 48px',
            }}
          />
        </div>
      </div>
    </section>
  );
}
