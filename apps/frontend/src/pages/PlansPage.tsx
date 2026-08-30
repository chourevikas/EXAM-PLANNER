import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Star, ArrowRight, Lock, Sparkles } from 'lucide-react';
import { PublicLayout } from '../components/common/PublicLayout';

const FEATURES = [
  'Unlimited Access to 25+ Years UPSC CSE PYQs',
  'Full-Length & Sectional Smart Mock Test Series',
  'Deep Psychometric Option Hesitation & Mistake Tracking',
  'Dynamic Adaptive Daily Study Planner',
  'All India Rank Projection & Percentile Matrix',
  'Priority 24/7 Doubt Resolution & Detailed Explanations',
  'Export Performance Reports & Revision Worksheets',
];

const FAQS = [
  {
    q: 'Can I switch between monthly and annual billing later?',
    a: 'Yes. You can change your billing cycle any time from your account settings after upgrading.',
  },
  {
    q: 'Do I need a credit card to start on the Free plan?',
    a: 'No. The Free Starter plan requires no payment details - just create an account and start practicing.',
  },
  {
    q: 'What happens to my progress if I upgrade mid-month?',
    a: 'Nothing is lost. Your study logs, attempts, and analytics carry over automatically when you upgrade.',
  },
];

export function PlansPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  return (
    <PublicLayout>
      {/* Hero */}
      <section
        className="landing-section-padding"
        style={{
          background: 'var(--bg-body)',
          paddingTop: 'clamp(96px, 11vw, 128px)',
          textAlign: 'center',
        }}
      >
        <div className="landing-container">
          <div className="section-label" style={{ justifyContent: 'center' }}>Pricing</div>
          <h1 className="section-heading" style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>
            Simple, Transparent Pricing
          </h1>
          <p className="section-subheading" style={{ color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto 32px' }}>
            Start free. Upgrade to Pro when you're ready for unlimited PYQs, adaptive mock tests, and
            full psychometric analytics.
          </p>

          {/* Billing Toggle */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: 6,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '8px 20px',
                border: 'none',
                backgroundColor: billingCycle === 'monthly' ? 'var(--bg-body)' : 'transparent',
                color: billingCycle === 'monthly' ? 'var(--text-main)' : 'var(--text-muted)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              style={{
                padding: '8px 20px',
                border: 'none',
                backgroundColor: billingCycle === 'annual' ? 'var(--accent-primary)' : 'transparent',
                color: billingCycle === 'annual' ? '#ffffff' : 'var(--text-muted)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>Annual Plan</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  color: '#fff',
                  fontWeight: 800,
                }}
              >
                SAVE 50%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="landing-section-padding" style={{ background: 'var(--bg-body)', paddingTop: 0 }}>
        <div
          className="landing-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 28,
            maxWidth: 960,
          }}
        >
          {/* Free Plan */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: 32,
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Free Starter
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
                ₹0 <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>/ forever</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px 0' }}>
                Basic access for beginners starting their prelims journey.
              </p>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-main)' }}>
                  <Check size={18} color="var(--success-primary)" />
                  <span>10 Free PYQs per day</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-main)' }}>
                  <Check size={18} color="var(--success-primary)" />
                  <span>1 Full Mock Test</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-muted)', opacity: 0.6 }}>
                  <Lock size={16} />
                  <span>Basic Accuracy Stats</span>
                </div>
              </div>
            </div>

            <button
              className="btn btn-ghost"
              style={{ marginTop: 32, padding: '14px', fontSize: 14 }}
              onClick={() => navigate('/signup')}
            >
              Start Free
            </button>
          </div>

          {/* Pro Plan */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: 32,
              border: '2px solid var(--accent-primary)',
              boxShadow: '0 16px 36px var(--shadow-color-accent)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                padding: '4px 12px',
                backgroundColor: 'var(--accent-bg)',
                border: '1px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Star size={13} fill="var(--accent-primary)" color="var(--accent-primary)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)' }}>MOST POPULAR</span>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                ExamPlanner Pro Membership
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
                {billingCycle === 'annual' ? '₹499' : '₹999'}
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)' }}>/ month</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--success-primary)', fontWeight: 600, marginBottom: 20 }}>
                {billingCycle === 'annual' ? 'Billed annually (₹5,988/yr) • Save ₹6,000' : 'Billed monthly'}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {FEATURES.map((feat) => (
                  <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-main)' }}>
                    <Check size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary anim-glow"
              style={{ marginTop: 32, padding: '16px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={() => navigate('/signup')}
            >
              <span>Get Started with Pro</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="landing-section-padding" style={{ background: 'var(--bg-card)' }}>
        <div className="landing-container" style={{ maxWidth: 720 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className="section-label" style={{ justifyContent: 'center' }}>
              <Sparkles size={14} /> FAQ
            </div>
            <h2 className="section-heading" style={{ fontWeight: 800, color: 'var(--text-main)' }}>
              Common Questions
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {FAQS.map((item) => (
              <div key={item.q} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>{item.q}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
