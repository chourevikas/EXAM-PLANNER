import React from 'react';
import { Ico } from '../common/Icons';
import { HeroIllustration } from './HeroIllustration';

interface HeroSectionProps {
  onSignup: () => void;
  onLogin: () => void;
}

export function HeroSection({ onSignup, onLogin }: HeroSectionProps) {
  return (
    <section
      style={{
        paddingTop: 136,
        paddingBottom: 96,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg-body)',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Dot grid */}
      <div
        className="dot-grid"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Map silhouette */}
      <svg
        style={{
          position: 'absolute',
          right: '2%',
          top: '5%',
          width: 380,
          height: 440,
          opacity: 0.03,
          pointerEvents: 'none',
        }}
        viewBox="0 0 380 440"
      >
        <path
          d="M190 20 C240 28 295 55 320 95 C345 135 350 175 335 210 C325 235 340 250 332 278 C322 308 298 338 272 365 C248 390 220 415 190 428 C160 415 132 390 108 365 C82 338 58 308 48 278 C40 250 55 235 45 210 C30 175 35 135 60 95 C85 55 140 28 190 20Z"
          fill="var(--text-main)"
        />
      </svg>

      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '0 52px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 72,
          alignItems: 'center',
        }}
      >
        {/* Left */}
        <div>
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
              padding: '6px 14px',
              marginBottom: 32,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--royal)' }}>✦</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--royal)' }}>
              AI-Powered UPSC Preparation Platform
            </span>
          </div>

          {/* Heading */}
          <h1
            className="anim-fade-up d-100"
            style={{
              fontSize: 62,
              fontWeight: 900,
              lineHeight: 1.06,
              letterSpacing: '-2px',
              color: 'var(--text-main)',
              marginBottom: 24,
            }}
          >
            Prepare<br />
            Smarter.<br />
            <span style={{ color: 'var(--royal)' }}>Crack UPSC</span><br />
            with AI.
          </h1>

          {/* Subheading */}
          <p
            className="anim-fade-up d-200"
            style={{
              fontSize: 18,
              color: 'var(--text-muted)',
              lineHeight: 1.72,
              marginBottom: 40,
              maxWidth: 460,
            }}
          >
            Solve Previous Year Questions, receive intelligent performance
            analysis, discover your weak areas, build personalized study plans,
            and prepare with your own AI Mentor.
          </p>

          {/* CTAs */}
          <div
            className="anim-fade-up d-300"
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 36,
              flexWrap: 'wrap',
            }}
          >
            <button
              className="btn btn-primary anim-glow"
              style={{ fontSize: 16, padding: '14px 28px' }}
              onClick={onSignup}
            >
              Get Started Free <Ico.Arrow />
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 16, padding: '14px 28px' }}
              onClick={onLogin}
            >
              Login to Platform
            </button>
          </div>

          {/* Trust badges */}
          <div
            className="anim-fade-up d-400"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}
          >
            {[
              'AI Powered',
              'Previous Year Questions',
              'Personalized Plans',
              'No Credit Card',
            ].map((b) => (
              <div
                key={b}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                }}
              >
                <span style={{ color: 'var(--emerald)' }}>
                  <Ico.Check size={14} />
                </span>
                {b}
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="anim-fade-up d-300">
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}
