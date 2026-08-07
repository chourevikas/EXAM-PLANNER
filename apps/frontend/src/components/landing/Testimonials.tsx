import React from 'react';
import { Ico } from '../common/Icons';

export function Testimonials() {
  const data = [
    {
      name: 'Arjun Sharma',
      exam: 'UPSC CSE 2024 · Rank 47',
      init: 'AS',
      photo: '/reviewer_arjun.png',
      accentColor: '#3b82f6',
      avatarBg: 'linear-gradient(135deg, #2563eb, #1D4ED8)',
      quote:
        'RankEdge completely changed how I prepared. The platform identified my weak spots in Polity within days — accuracy jumped from 54% to 83% in just two months.',
    },
    {
      name: 'Priya Nair',
      exam: 'UPSC CSE 2024 · Selected IAS',
      init: 'PN',
      photo: '/reviewer_priya.png',
      accentColor: '#10b981',
      avatarBg: 'linear-gradient(135deg, #10b981, #059669)',
      quote:
        'The personalized study plan felt like having a dedicated mentor. I never had to wonder what to study — the AI always knew exactly where I needed to focus.',
    },
    {
      name: 'Rohit Gupta',
      exam: 'SSC CGL 2024 · AIR 12',
      init: 'RG',
      photo: '/reviewer_rohit.png',
      accentColor: '#f59e0b',
      avatarBg: 'linear-gradient(135deg, #f59e0b, #EA580C)',
      quote:
        '10,000+ questions with intelligent tagging is a game-changer. I solved 4 years of PYQs systematically and the AI analysis caught every gap.',
    },
  ];

  return (
    <section
      className="landing-section-padding"
      style={{
        background: 'var(--bg-body)',
        transition: 'background-color 0.3s ease',
      }}
    >
      <div className="landing-container">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            Student Stories
          </div>
          <h2
            className="section-heading"
            style={{ fontWeight: 800, color: 'var(--text-main)' }}
          >
            What Aspirants Say
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((d) => (
            <div
              key={d.name}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 22,
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.28s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(-5px)';
                el.style.borderColor = d.accentColor + '44';
                el.style.boxShadow = `0 16px 40px ${d.accentColor}18`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.transform = 'translateY(0)';
                el.style.borderColor = 'var(--border-color)';
                el.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              {/* Top accent bar */}
              <div
                style={{
                  height: 3,
                  background: `linear-gradient(90deg, ${d.accentColor} 0%, ${d.accentColor}44 70%, transparent 100%)`,
                  flexShrink: 0,
                }}
              />

              {/* Card body */}
              <div style={{ padding: '28px 28px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 18 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ico.Star key={i} filled />
                  ))}
                </div>

                {/* Quote */}
                <p
                  style={{
                    fontSize: 14.5,
                    color: 'var(--text-main)',
                    lineHeight: 1.75,
                    flex: 1,
                    fontStyle: 'italic',
                    marginBottom: 24,
                  }}
                >
                  "{d.quote}"
                </p>

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg, ${d.accentColor}33 0%, var(--border-color) 100%)`,
                    marginBottom: 20,
                  }}
                />

                {/* Author row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Photo */}
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: `2px solid ${d.accentColor}55`,
                      boxShadow: `0 4px 14px ${d.accentColor}30`,
                      position: 'relative',
                    }}
                  >
                    <img
                      src={d.photo}
                      alt={d.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top',
                        display: 'block',
                      }}
                      onError={(e) => {
                        // Fallback to initials avatar if image fails
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement!;
                        parent.style.background = d.avatarBg;
                        parent.style.display = 'flex';
                        parent.style.alignItems = 'center';
                        parent.style.justifyContent = 'center';
                        parent.innerHTML = `<span style="color:#fff;font-weight:800;font-size:15px">${d.init}</span>`;
                      }}
                    />
                  </div>

                  {/* Name + Exam */}
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        marginBottom: 2,
                      }}
                    >
                      {d.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: d.accentColor,
                        fontWeight: 600,
                        letterSpacing: '0.2px',
                      }}
                    >
                      {d.exam}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
