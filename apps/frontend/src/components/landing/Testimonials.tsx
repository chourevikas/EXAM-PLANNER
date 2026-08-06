import React from 'react';
import { Ico } from '../common/Icons';

export function Testimonials() {
  const data = [
    {
      name: 'Arjun Sharma',
      exam: 'UPSC CSE 2024 · Rank 47',
      init: 'AS',
      bg: 'linear-gradient(135deg, var(--royal), #1D4ED8)',
      quote:
        'PrepAI completely changed how I prepared. The AI identified my weak spots in Polity within days — accuracy jumped from 54% to 83% in just two months.',
    },
    {
      name: 'Priya Nair',
      exam: 'UPSC CSE 2024 · Selected IAS',
      init: 'PN',
      bg: 'linear-gradient(135deg, var(--emerald), #059669)',
      quote:
        'The personalized study plan felt like having a dedicated mentor. I never had to wonder what to study — the AI always knew exactly where I needed to focus.',
    },
    {
      name: 'Rohit Gupta',
      exam: 'SSC CGL 2024 · AIR 12',
      init: 'RG',
      bg: 'linear-gradient(135deg, var(--saffron), #EA580C)',
      quote:
        '10,000+ questions with intelligent tagging is a game-changer. I solved 4 years of PYQs systematically and the AI analysis caught every gap.',
    },
  ];

  return (
    <section
      className="landing-section-padding"
      style={{
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-color)',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <div className="landing-container">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            Student Stories
          </div>
          <h2
            className="section-heading"
            style={{
              fontWeight: 800,
              color: 'var(--text-main)',
            }}
          >
            What Aspirants Say
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((d) => (
            <div key={d.name} className="testimonial-card">
              <div style={{ display: 'flex', gap: 3, marginBottom: 20 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ico.Star key={i} filled />
                ))}
              </div>
              <p
                style={{
                  fontSize: 15,
                  color: 'var(--text-main)',
                  lineHeight: 1.72,
                  marginBottom: 24,
                  fontStyle: 'italic',
                }}
              >
                "{d.quote}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: d.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {d.init}
                </div>
                <div>
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}
                  >
                    {d.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.exam}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

