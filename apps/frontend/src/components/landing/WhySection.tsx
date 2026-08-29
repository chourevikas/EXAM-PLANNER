import React from 'react';
import { Ico } from '../common/Icons';

const palettes = {
  blue:   { color: '#E31B23', bg: 'rgba(227,27,35,0.08)',  border: 'rgba(227,27,35,0.2)',  glow: 'rgba(227,27,35,0.15)'  },
  violet: { color: '#F2B623', bg: 'rgba(242,182,35,0.08)', border: 'rgba(242,182,35,0.2)', glow: 'rgba(242,182,35,0.15)' },
  emerald:{ color: '#3A8B53', bg: 'rgba(58,139,83,0.08)', border: 'rgba(58,139,83,0.2)', glow: 'rgba(58,139,83,0.15)' },
};

export function WhySection() {
  return (
    <section
      id="about"
      className="landing-section-padding"
      style={{ background: 'var(--bg-body)', transition: 'background-color 0.3s ease' }}
    >
      <div className="landing-container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>Why ExamPlanner</div>
          <h2
            className="section-heading"
            style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}
          >
            Built Different, by Design
          </h2>
          <p
            className="section-subheading"
            style={{ color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto' }}
          >
            Not a generic coaching platform. A precision instrument built for serious exam aspirants.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="why-bento-grid">

          {/* ── LEFT tall card ── Smarter Than MCQ Platforms */}
          <div
            className="why-bento-card why-bento-featured"
            style={{
              background: `linear-gradient(145deg, ${palettes.blue.bg} 0%, var(--bg-card) 60%)`,
              border: `1px solid ${palettes.blue.border}`,
            }}
          >
            {/* Watermark icon */}
            <div className="why-bento-watermark" style={{ color: palettes.blue.color }}>
              <Ico.Brain />
            </div>

            {/* Top accent bar */}
            <div className="why-bento-top-bar" style={{ background: `linear-gradient(90deg, ${palettes.blue.color}, transparent)` }} />

            {/* Large icon */}
            <div
              className="why-bento-icon"
              style={{
                background: palettes.blue.bg,
                border: `1px solid ${palettes.blue.border}`,
                color: palettes.blue.color,
                boxShadow: `0 0 32px ${palettes.blue.glow}`,
              }}
            >
              <Ico.Brain />
              {/* Orbit ring */}
              <div className="why-bento-orbit" style={{ borderColor: palettes.blue.border }} />
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '1.2px',
                textTransform: 'uppercase' as const,
                color: palettes.blue.color,
                marginBottom: 10,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Core Intelligence
            </div>

            <h3 className="why-bento-featured-title" style={{ color: 'var(--text-main)' }}>
              Smarter Than Any MCQ Platform
            </h3>

            <p style={{ fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.72, marginBottom: 28 }}>
              ExamPlanner doesn't just throw questions at you — it understands your learning patterns,
              predicts where you'll lose marks, and adapts every session to fix exactly that.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'IRT-calibrated question selection',
                'Behavioral performance fingerprinting',
                'Subject-level mastery heat maps',
              ].map((pt) => (
                <div key={pt} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 0,
                      background: palettes.blue.bg,
                      border: `1px solid ${palettes.blue.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: palettes.blue.color,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <Ico.Check size={11} />
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text-main)', lineHeight: 1.55 }}>{pt}</span>
                </div>
              ))}
            </div>

            {/* Bottom stat strip */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 28,
                display: 'flex',
                gap: 28,
                borderTop: `1px solid ${palettes.blue.border}`,
              }}
            >
              {[{ val: '94%', label: 'Diagnostic Precision' }, { val: '3×', label: 'Faster Gap Closure' }].map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: palettes.blue.color, letterSpacing: '-0.5px' }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT column ── */}
          <div className="why-bento-right">

            {/* Top-right card — Data-Driven */}
            <div
              className="why-bento-card"
              style={{
                background: `linear-gradient(135deg, ${palettes.emerald.bg} 0%, var(--bg-card) 70%)`,
                border: `1px solid ${palettes.emerald.border}`,
              }}
            >
              <div className="why-bento-top-bar" style={{ background: `linear-gradient(90deg, ${palettes.emerald.color}, transparent)` }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 0,
                    background: palettes.emerald.bg,
                    border: `1px solid ${palettes.emerald.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: palettes.emerald.color,
                    flexShrink: 0,
                    boxShadow: `0 0 20px ${palettes.emerald.glow}`,
                  }}
                >
                  <Ico.Chart />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '1px',
                      textTransform: 'uppercase' as const,
                      color: palettes.emerald.color,
                      marginBottom: 4,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Insights Engine
                  </div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      lineHeight: 1.25,
                    }}
                  >
                    Data-Driven Preparation
                  </h3>
                </div>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
                Visual accuracy dashboards, exam-readiness scores, and granular time insights — all computed automatically, all in real-time.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Visual accuracy trend dashboards', 'Cognitive Readiness Index (ICRS)', 'Granular time management insights'].map((pt) => (
                  <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: palettes.emerald.color, flexShrink: 0 }}><Ico.Check size={13} /></span>
                    <span style={{ fontSize: 13.5, color: 'var(--text-main)' }}>{pt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom-right card — Fully Personalized */}
            <div
              className="why-bento-card"
              style={{
                background: `linear-gradient(135deg, ${palettes.violet.bg} 0%, var(--bg-card) 70%)`,
                border: `1px solid ${palettes.violet.border}`,
              }}
            >
              <div className="why-bento-top-bar" style={{ background: `linear-gradient(90deg, ${palettes.violet.color}, transparent)` }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 0,
                    background: palettes.violet.bg,
                    border: `1px solid ${palettes.violet.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: palettes.violet.color,
                    flexShrink: 0,
                    boxShadow: `0 0 20px ${palettes.violet.glow}`,
                  }}
                >
                  <Ico.Cal />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '1px',
                      textTransform: 'uppercase' as const,
                      color: palettes.violet.color,
                      marginBottom: 4,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Study Plans
                  </div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      lineHeight: 1.25,
                    }}
                  >
                    Fully Personalized
                  </h3>
                </div>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
                Spaced repetition, goal-aligned schedules, and revision priority queues — your study plan evolves as you do.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Custom spaced-repetition scheduling', 'Goal-aligned daily study plans', 'Personalized revision priority queues'].map((pt) => (
                  <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: palettes.violet.color, flexShrink: 0 }}><Ico.Check size={13} /></span>
                    <span style={{ fontSize: 13.5, color: 'var(--text-main)' }}>{pt}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
