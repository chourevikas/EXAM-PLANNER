import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PublicLayout } from '../components/common/PublicLayout';
import { Ico } from '../components/common/Icons';

const FOUNDER_STATS = [
  { value: '22', label: 'Prelims Attempts' },
  { value: '21', label: 'Mains Attempts' },
  { value: '15', label: 'Personality Tests' },
];

const PILLARS = [
  { icon: Ico.Book, title: 'PYQs Are Our Foundation', desc: 'Previous Year Questions are the starting point of preparation, not an afterthought.' },
  { icon: Ico.Trend, title: 'Trend & Pattern Analysis', desc: 'Understand recurring themes, question patterns, and how trends shift year over year.' },
  { icon: Ico.Chart, title: 'Topic-Wise PYQ Analysis', desc: 'Subject-wise and topic-wise breakdowns so you know exactly where to focus.' },
];

const PHILOSOPHY = [
  'PYQs first.',
  'Analysis next.',
  'Preparation with purpose.',
  'Revision with direction.',
  'Performance through practice.',
];

export function AboutUsPage() {
  const navigate = useNavigate();

  return (
    <PublicLayout>
      {/* Hero */}
      <section
        className="landing-section-padding"
        style={{
          background: 'var(--bg-body)',
          paddingTop: 'clamp(96px, 11vw, 128px)',
        }}
      >
        <div className="landing-container" style={{ maxWidth: 780, textAlign: 'center' }}>
          <div className="section-label" style={{ justifyContent: 'center' }}>About Us</div>
          <h1 className="section-heading" style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            EXAM PLANNER
          </h1>
          <p className="section-subheading" style={{ color: 'var(--text-muted)', margin: '0 auto' }}>
            A PYQ-based preparation platform founded by past and current CSE aspirants with a
            cumulative experience of 22 Prelims, 21 Mains, and 15 Personality Tests.
          </p>
        </div>

        {/* Founder Experience Stats */}
        <div
          className="landing-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 20,
            maxWidth: 620,
            marginTop: 44,
          }}
        >
          {FOUNDER_STATS.map((s) => (
            <div
              key={s.label}
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PYQ Description */}
      <section className="landing-section-padding" style={{ background: 'var(--bg-card)' }}>
        <div className="landing-container" style={{ maxWidth: 780, textAlign: 'center' }}>
          <p style={{ fontSize: 17, color: 'var(--text-main)', lineHeight: 1.75, margin: '0 auto' }}>
            The platform uses Previous Year Questions (PYQs) as the foundation of preparation,
            helping aspirants identify recurring themes, understand question patterns, analyse
            changing trends, connect static concepts with current affairs, and prioritize what
            truly matters.
          </p>
        </div>

        {/* Pillars */}
        <div
          className="landing-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 20,
            marginTop: 44,
          }}
        >
          {PILLARS.map((p) => (
            <div key={p.title} style={{ padding: 28, backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
              <div
                style={{
                  width: 44, height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                  color: 'var(--accent-primary)', marginBottom: 16,
                }}
              >
                <p.icon size={20} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8 }}>{p.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Motto */}
      <section className="landing-section-padding" style={{ background: 'var(--deep-navy)', textAlign: 'center' }}>
        <div className="landing-container" style={{ maxWidth: 720 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--primary-red)', marginBottom: 18, fontFamily: 'var(--font-mono)' }}>
            Our Motto
          </div>
          <p
            style={{
              fontSize: 'clamp(22px, 3.5vw, 32px)',
              fontWeight: 700,
              color: 'var(--bg-card)',
              lineHeight: 1.5,
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            “Mistakes we have committed should not be repeated by aspirants.”
          </p>
        </div>
      </section>

      {/* Philosophy */}
      <section className="landing-section-padding" style={{ background: 'var(--bg-body)' }}>
        <div className="landing-container" style={{ maxWidth: 780 }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div className="section-label" style={{ justifyContent: 'center' }}>Our Philosophy</div>
            <h2 className="section-heading" style={{ fontWeight: 800, color: 'var(--text-main)' }}>
              A clear sequence, followed every time
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {PHILOSOPHY.map((step, idx) => (
              <div
                key={step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '18px 24px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderTop: idx === 0 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--accent-primary)', color: 'var(--bg-card)',
                    fontSize: 14, fontWeight: 800,
                  }}
                >
                  {idx + 1}
                </div>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-section-padding" style={{ background: 'var(--bg-card)', textAlign: 'center' }}>
        <div className="landing-container">
          <h2 className="section-heading" style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>
            Always Plan Ahead.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '0 0 28px 0' }}>
            Start preparing the way toppers actually revise - PYQ first.
          </p>
          <button
            className="btn btn-primary anim-glow touch-target"
            style={{ fontSize: 16, padding: '14px 32px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            onClick={() => navigate('/signup')}
          >
            Create Your Free Account <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </PublicLayout>
  );
}
