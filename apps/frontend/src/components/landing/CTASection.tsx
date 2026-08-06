import React from 'react';
import { C } from '../../constants/theme';
import { Ico } from '../common/Icons';

interface CTASectionProps {
  onSignup: () => void;
  onLogin: () => void;
}

export function CTASection({ onSignup, onLogin }: CTASectionProps) {
  return (
    <section
      id="pricing"
      className="landing-section-padding"
      style={{
        background: C.navy,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '100%',
          maxWidth: 800,
          height: 500,
          background:
            'radial-gradient(ellipse,rgba(37,99,235,0.18) 0%,transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle,${C.slate400} 1px,transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
      />

      <div
        className="landing-container"
        style={{
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(37,99,235,0.15)',
            border: '1px solid rgba(37,99,235,0.3)',
            borderRadius: 99,
            padding: '6px 18px',
            marginBottom: 24,
          }}
        >
          <div style={{ position: 'relative', width: 8, height: 8 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C.emerald,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.3)',
                animation: 'pulse-ring 1.5s ease infinite',
              }}
            />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#60A5FA' }}>
            Your AI Mentor Is Ready
          </span>
        </div>

        <h2
          className="hero-heading"
          style={{
            fontWeight: 900,
            color: '#fff',
            marginBottom: 20,
          }}
        >
          Your AI Mentor is Ready.
        </h2>
        <p
          className="section-subheading"
          style={{
            color: C.slate400,
            maxWidth: 520,
            margin: '0 auto 40px',
          }}
        >
          Join thousands of aspirants preparing smarter with AI. Start free — no
          credit card, no commitment.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 14,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="btn btn-primary anim-glow"
            style={{ fontSize: 16, padding: '15px 32px' }}
            onClick={onSignup}
          >
            Start Preparing Free <Ico.Arrow />
          </button>
          <button className="btn-dark" onClick={onLogin}>
            Login to Continue
          </button>
        </div>
      </div>
    </section>
  );
}

