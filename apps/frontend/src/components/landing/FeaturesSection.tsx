import React, { ReactNode } from 'react';
import { Ico } from '../common/Icons';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  desc: string;
  accent?: boolean;
}

export function FeatureCard({ icon, title, desc, accent }: FeatureCardProps) {
  return (
    <div
      className="feature-card"
      style={
        accent
          ? {
              borderColor: 'rgba(59, 130, 246, 0.35)',
              boxShadow: 'var(--shadow-md)',
            }
          : {}
      }
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          marginBottom: 18,
          background: accent ? 'var(--blue50)' : 'var(--bg-secondary)',
          border: `1px solid ${accent ? 'var(--blue100)' : 'var(--border-color)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accent ? 'var(--royal)' : 'var(--text-main)',
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.68 }}>{desc}</p>
    </div>
  );
}

export function FeaturesSection() {
  const features = [
    {
      icon: <Ico.Chart />,
      title: 'AI Performance Analysis',
      desc: 'Deep subject-level accuracy tracking, time analysis, and behavioral performance insights.',
      accent: true,
    },
    {
      icon: <Ico.Cal />,
      title: 'Personalized Study Planner',
      desc: 'Daily AI-generated plans that adapt dynamically as your strengths and weaknesses evolve.',
    },
    {
      icon: <Ico.Book />,
      title: '10,000+ PYQs',
      desc: 'Complete question bank from 2000–2024, tagged by year, topic, difficulty, and predicted importance.',
    },
    {
      icon: <Ico.Brain />,
      title: 'AI Mentor',
      desc: 'Ask any UPSC conceptual doubt and receive instant, syllabus-grounded, precise answers.',
    },
    {
      icon: <Ico.Refresh />,
      title: 'Revision & Retention Tracker',
      desc: 'Spaced repetition ensures every topic is reviewed at the scientifically optimal interval.',
    },
    {
      icon: <Ico.Trend />,
      title: 'Performance Analytics',
      desc: 'Visual dashboards with accuracy curves, improvement velocity, and an AI-computed readiness score.',
    },
  ];

  return (
    <section id="features" style={{ padding: '104px 0', background: 'var(--bg-body)', transition: 'background-color 0.3s ease' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 52px' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>
            Platform Features
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
            Everything You Need
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
            A complete AI ecosystem built exclusively for UPSC preparation —
            nothing generic, nothing unnecessary.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 20,
          }}
        >
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}
