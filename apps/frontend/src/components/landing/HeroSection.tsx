import React from 'react';
import { Zap, BookOpen, Map, Unlock } from 'lucide-react';
import { HeroIllustration } from './HeroIllustration';

interface HeroSectionProps {
  onSignup: () => void;
  onLogin: () => void;
}

const trustPills = [
  { icon: Zap,      label: 'Psychometric Performance Analysis' },
  { icon: BookOpen, label: 'Real PYQ Bank' },
  { icon: Map,      label: 'Adaptive Study Plans' },
  { icon: Unlock,   label: 'Free to Start' },
];

export function HeroSection({ onSignup }: HeroSectionProps) {
  return (
    <section
      className="hero-section-padding"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-body)',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Dot grid */}
      <div
        className="dot-grid"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />

      {/* Subtle radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 900,
          height: 500,
          background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="landing-container">
        <div
          className="hero-grid"
          style={{
            display: 'grid',
            alignItems: 'center',
          }}
        >
          {/* Left Content */}
          <div style={{ maxWidth: 600 }}>
            {/* Badge */}
            <div
              className="anim-fade-up"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--blue50)',
                border: '1px solid var(--blue100)',
                borderRadius: 99,
                padding: '6px 16px',
                marginBottom: 28,
              }}
            >
              <Zap size={12} strokeWidth={2.5} style={{ color: 'var(--royal)' }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--royal)', letterSpacing: '0.3px' }}>
                Next-Gen IRT Exam Preparation System
              </span>
            </div>

            {/* Headline */}
            <h1
              className="anim-fade-up d-100 hero-heading"
              style={{
                fontWeight: 900,
                color: 'var(--text-main)',
                marginBottom: 18,
              }}
            >
              Your Rank is a
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 60%, #7C3AED 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Decision.
              </span>
            </h1>

            {/* Sub-headline */}
            <p
              className="anim-fade-up d-150"
              style={{
                fontSize: 'clamp(1.05rem, 1.5vw + 0.4rem, 1.2rem)',
                fontWeight: 600,
                color: 'var(--royal)',
                marginBottom: 12,
                letterSpacing: '-0.1px',
              }}
            >
              Every choice shapes your success story.
            </p>

            {/* Sub-description */}
            <p
              className="anim-fade-up d-200 section-subheading"
              style={{
                color: 'var(--text-muted)',
                marginBottom: 40,
                maxWidth: 500,
              }}
            >
              Solve real Previous Year Questions, discover your weak areas with
              intelligent analysis, and follow an adaptive plan tailored by
              your Personal Learning Engine — built for serious exam aspirants.
            </p>

            {/* Trust Pill Chips */}
            <div
              className="anim-fade-up d-300"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              {trustPills.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 99,
                    padding: '7px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
                    transition: 'border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.borderColor = 'var(--royal)';
                    el.style.color = 'var(--royal)';
                    el.style.boxShadow = '0 2px 10px rgba(37,99,235,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.borderColor = 'var(--border-color)';
                    el.style.color = 'var(--text-muted)';
                    el.style.boxShadow = '0 1px 4px rgba(15,23,42,0.06)';
                  }}
                >
                  <Icon size={13} strokeWidth={2.5} style={{ color: 'var(--royal)', flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Right Illustration */}
          <div className="anim-fade-up d-300 hero-illustration-wrap">
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
