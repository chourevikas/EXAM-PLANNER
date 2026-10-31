import React, { useState, useEffect } from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  Zap,
  Check,
  Star,
  CheckCircle2,
  Lock,
} from 'lucide-react';

/** The signed-in student's plan, from the stored profile (refreshed from /auth/me when the app loads). */
function currentPlan(): { isPro: boolean; endsAt: string | null } {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return { isPro: u.subscription_tier === 'PREMIUM', endsAt: u.subscription_ends_at || null };
  } catch {
    return { isPro: false, endsAt: null };
  }
}

export function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const { isPro, endsAt } = currentPlan();
  const endsLabel = endsAt ? new Date(endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  useEffect(() => {
    import('../services/premiumService').then(m => {
      m.fetchPublicPlans()
        .then(data => {
          setPlans(data);
          // Open on the tab that has a paid plan (there may be no annual plan)
          const hasAnnual = data.some((pl: any) => ['ANNUAL', 'YEARLY'].includes(String(pl.billing_interval).toUpperCase()));
          if (!hasAnnual && data.length) setBillingCycle('monthly');
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingPlans(false));
    });
  }, []);

  // Only features the app actually has today
  const features = [
    'Unlimited PYQ practice across every uploaded paper',
    'Full post-test analysis: subject, topic, time and answer-change insights',
    'AI-written performance summary after every test',
    'Bookmarks with full solutions and explanations',
    'Study planner with daily and weekly targets',
    'Projected rank and percentile from your test scores',
    'Unlimited friend challenges',
  ];

  return (
    <StudentLayout pageTitle="Pro Subscription">
      {/* Header Banner */}
      <section style={{
        marginBottom: 36, padding: '40px 32px', borderRadius: 'var(--radius)',
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.08) 0%, rgba(var(--primary-red-rgb), 0.06) 50%, rgba(219,39,119,0.06) 100%)',
        textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 16px', backgroundColor: 'var(--accent-bg)', borderRadius: 'var(--radius)', marginBottom: 16, border: '1px solid var(--accent-border)' }}>
          <Zap size={16} color="var(--accent-primary)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Elevate Your Exam Preparation
          </span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
          Unlock Your Full Potential with ExamPlanner Pro
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-muted)', margin: '0 auto', maxWidth: 600, lineHeight: 1.6 }}>
          Unlimited PYQ practice, full post-test analysis and an AI-written summary after every test.
        </p>

        {/* Billing Toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 28, padding: 6, backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
          <button
            onClick={() => setBillingCycle('monthly')}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius)', border: 'none',
              backgroundColor: billingCycle === 'monthly' ? 'var(--bg-card)' : 'transparent',
              color: billingCycle === 'monthly' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: billingCycle === 'monthly' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            style={{
              padding: '8px 20px', borderRadius: 'var(--radius)', border: 'none',
              backgroundColor: billingCycle === 'annual' ? 'var(--accent-primary)' : 'transparent',
              color: billingCycle === 'annual' ? 'var(--bg-card)' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: billingCycle === 'annual' ? '0 4px 12px var(--shadow-color-accent)' : 'none'
            }}
          >
            <span>Annual Plan</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius)', backgroundColor: 'rgba(255,255,255,0.25)', color: '#FFF', fontWeight: 800 }}>
              SAVE 50%
            </span>
          </button>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28, maxWidth: 960, margin: '0 auto 40px auto' }}>

        {/* Free Plan Card */}
        <div style={{
          backgroundColor: 'var(--bg-card)', padding: 32, borderRadius: 'var(--radius)',
          border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Free Starter
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
              ₹0 <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>/ forever</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 24px 0' }}>
              Basic access for beginners starting their prelims journey.
            </p>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                <Check size={18} color="var(--success-primary)" />
                <span>20 questions a day across tests and practice</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                <Check size={18} color="var(--success-primary)" />
                <span>Start any paper, full-length included</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                <Check size={18} color="var(--success-primary)" />
                <span>Score, correct answers and explanations after every test</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-muted)', opacity: 0.6 }}>
                <Lock size={16} />
                <span>Post-test analysis and AI summary</span>
              </div>
            </div>
          </div>

          <button
            disabled
            style={{
              marginTop: 32, padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
              cursor: 'not-allowed'
            }}
          >
            {isPro ? 'Free plan' : 'Current Plan'}
          </button>
        </div>

        {/* Dynamic Paid Plans */}
        {loadingPlans ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading plans...</div>
        ) : (
          plans.filter(plan => {
            if (billingCycle === 'monthly' && plan.billing_interval.toUpperCase() !== 'MONTHLY') return false;
            if (billingCycle === 'annual' && !['ANNUAL', 'YEARLY'].includes(plan.billing_interval.toUpperCase())) return false;
            return true;
          }).map((plan, index) => (
            <div key={plan.id} style={{
              backgroundColor: 'var(--bg-card)', padding: 32, borderRadius: 'var(--radius)',
              border: index === 0 ? '2px solid var(--accent-primary)' : '1px solid var(--border-default)', 
              boxShadow: index === 0 ? '0 16px 36px var(--shadow-color-accent)' : 'var(--shadow-color-base)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Best Value Ribbon for first dynamic plan */}
              {index === 0 && (
                <div style={{
                  position: 'absolute', top: 18, right: 18, padding: '4px 12px',
                  backgroundColor: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                  borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <Star size={13} fill="var(--accent-primary)" color="var(--accent-primary)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)' }}>MOST POPULAR</span>
                </div>
              )}

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: index === 0 ? 'var(--accent-primary)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {plan.currency === 'INR' ? '₹' : plan.currency}{plan.price_cents / 100}
                  <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)' }}>/ {plan.billing_interval.toLowerCase()}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--success-primary)', fontWeight: 600, marginBottom: 20 }}>
                  Billed {plan.billing_interval.toLowerCase()}
                </div>

                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-primary)' }}>
                      <CheckCircle2 size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isPro ? (
                <div
                  data-testid="pro-active"
                  style={{
                    marginTop: 32, padding: '14px 16px', borderRadius: 'var(--radius)', textAlign: 'center',
                    backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', fontSize: 14, fontWeight: 700,
                  }}
                >
                  <CheckCircle2 size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  You're on Pro{endsLabel ? ` until ${endsLabel}` : ''}
                </div>
              ) : (
              <>
              {/* Online payment isn't live yet: no checkout until it is (it used to fake one in the browser) */}
              <button
                type="button"
                disabled
                aria-describedby="pro-availability"
                style={{
                  marginTop: 32, padding: '16px', borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)',
                  border: '1px solid var(--border-default)', fontSize: 15, fontWeight: 700,
                  cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Lock size={16} />
                <span>Online payment coming soon</span>
              </button>
              <p id="pro-availability" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                Want {plan.name} now? Write to{' '}
                <a href="mailto:support@examplanner.in" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>support@examplanner.in</a>
                {' '}and we'll activate it for you.
              </p>
              </>
              )}
            </div>
          ))
        )}

      </div>

    </StudentLayout>
  );
}
