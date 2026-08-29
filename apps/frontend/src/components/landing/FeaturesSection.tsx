import React, { ReactNode } from 'react';
import { Ico } from '../common/Icons';

const iconPalettes = [
  { color: '#E31B23', bg: 'rgba(227, 27, 35,0.15)',  glow: 'rgba(227, 27, 35,0.25)',  border: 'rgba(227, 27, 35,0.3)'  },
  { color: '#3A8B53', bg: 'rgba(16,185,129,0.15)',  glow: 'rgba(16,185,129,0.25)',  border: 'rgba(16,185,129,0.3)'  },
  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  glow: 'rgba(139,92,246,0.25)',  border: 'rgba(139,92,246,0.3)'  },
  { color: '#F2B623', bg: 'rgba(245,158,11,0.15)',  glow: 'rgba(245,158,11,0.25)',  border: 'rgba(245,158,11,0.3)'  },
  { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   glow: 'rgba(6,182,212,0.25)',   border: 'rgba(6,182,212,0.3)'   },
  { color: '#ec4899', bg: 'rgba(236,72,153,0.15)',  glow: 'rgba(236,72,153,0.25)',  border: 'rgba(236,72,153,0.3)'  },
];

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
  num: string;
}

interface FeatureCardProps extends Feature {
  paletteIndex: number;
}

function FeatureCard({ icon, title, desc, num, paletteIndex }: FeatureCardProps) {
  const p = iconPalettes[paletteIndex % iconPalettes.length];

  return (
    <div
      className="feature-marquee-card"
      style={{
        width: 300,
        minHeight: 230,
        flexShrink: 0,
        background: 'var(--bg-card)',
        borderRadius: 0,
        padding: '28px 26px',
        border: `1px solid ${p.border}`,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        boxShadow: `0 4px 24px ${p.glow}, 0 1px 0 rgba(255,255,255,0.08) inset`,
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        cursor: 'default',
      }}
    >
      {/* Large watermark number */}
      <div
        style={{
          position: 'absolute',
          bottom: -10,
          right: 10,
          fontSize: 96,
          fontWeight: 900,
          color: p.color,
          opacity: 0.06,
          lineHeight: 1,
          fontFamily: 'var(--font-display)',
          userSelect: 'none',
          pointerEvents: 'none',
          letterSpacing: '-4px',
        }}
      >
        {num}
      </div>

      {/* Diagonal shimmer */}
      <div
        className="feature-shimmer"
        style={{
          position: 'absolute',
          top: 0,
          left: '-60%',
          width: '40%',
          height: '100%',
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
          pointerEvents: 'none',
          transition: 'left 0.6s ease',
        }}
      />

      {/* Icon with glow ring */}
      <div style={{ position: 'relative', width: 54, height: 54, marginBottom: 20 }}>
        {/* Outer glow ring */}
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: 0,
            background: p.glow,
            filter: 'blur(8px)',
          }}
        />
        {/* Icon chip */}
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 0,
            background: p.bg,
            border: `1px solid ${p.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: p.color,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {icon}
        </div>
      </div>

      <h3
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: 10,
          lineHeight: 1.3,
          position: 'relative',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13.5,
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          flex: 1,
          position: 'relative',
        }}
      >
        {desc}
      </p>

      {/* Bottom accent bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${p.color} 0%, ${p.color}44 60%, transparent 100%)`,
          borderRadius: 0,
        }}
      />
    </div>
  );
}

export function FeaturesSection() {
  const features: Feature[] = [
    { icon: <Ico.Chart />,   title: 'Psychometric Skill Analysis', desc: 'Deep subject-level accuracy tracking, time analysis, and behavioral performance insights.', num: '01' },
    { icon: <Ico.Cal />,     title: 'Personalized Study Planner', desc: 'Daily personalized plans that adapt dynamically as your strengths and weaknesses evolve.',   num: '02' },
    { icon: <Ico.Book />,    title: '10,000+ PYQs',               desc: 'Complete bank from 2000–2024, tagged by year, topic, difficulty, and predicted importance.',   num: '03' },
    { icon: <Ico.Brain />,   title: 'Smart Syllabus Mentor',      desc: 'Ask any conceptual doubt and receive instant, syllabus-grounded, precise answers.',            num: '04' },
    { icon: <Ico.Refresh />, title: 'Revision & Retention',       desc: 'Spaced repetition ensures every topic is reviewed at the scientifically optimal interval.',    num: '05' },
    { icon: <Ico.Trend />,   title: 'Performance Analytics',      desc: 'Visual dashboards with accuracy curves, improvement velocity, and Cognitive Readiness Index (ICRS).', num: '06' },
  ];

  // Duplicate ×3 for seamless loop
  const looped = [...features, ...features, ...features];

  return (
    <section
      id="features"
      className="landing-section-padding"
      style={{ background: 'var(--bg-body)', transition: 'background-color 0.3s ease', overflow: 'hidden' }}
    >
      <div className="landing-container">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>Platform Features</div>
          <h2
            className="section-heading"
            style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}
          >
            Everything You Need
          </h2>
          <p
            className="section-subheading"
            style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto' }}
          >
            Master UPSC with 10,000+ PYQs, adaptive study plans, and real-time psychometric performance tracking.
          </p>
        </div>
      </div>

      {/* Full-width marquee track — outside landing-container to bleed edges */}
      <div style={{ position: 'relative' }}>
        <div
          className="feature-marquee-outer"
          style={{ width: '100%', overflow: 'hidden', cursor: 'default' }}
        >
          <div className="feature-marquee-track">
            {looped.map((f, i) => (
              <FeatureCard
                key={i}
                {...f}
                paletteIndex={i % features.length}
              />
            ))}
          </div>
        </div>

        {/* Fade edge masks */}
        <div className="feature-marquee-fade-left" />
        <div className="feature-marquee-fade-right" />
      </div>
    </section>
  );
}
