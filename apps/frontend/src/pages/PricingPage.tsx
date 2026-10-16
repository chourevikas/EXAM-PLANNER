import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  Zap,
  Check,
  Star,
  ShieldCheck,
  CreditCard,
  QrCode,
  Building2,
  ArrowRight,
  CheckCircle2,
  Lock,
  Percent
} from 'lucide-react';

export function PricingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [finalPriceCents, setFinalPriceCents] = useState<number>(0);
  const [discountLabel, setDiscountLabel] = useState<string>('');

  useEffect(() => {
    import('../services/premiumService').then(m => {
      m.fetchPublicPlans()
        .then(data => setPlans(data))
        .catch(err => console.error(err))
        .finally(() => setLoadingPlans(false));
    });
  }, []);

  const handleApplyPromo = async () => {
    if (!promoCode || !selectedPlan) return;
    
    try {
      const { validateDiscount } = await import('../services/premiumService');
      const result = await validateDiscount(promoCode.trim(), selectedPlan.id);
      
      if (result.valid) {
        setFinalPriceCents(result.discounted_price_cents);
        setDiscountLabel(`✓ ${result.discount_type === 'PERCENTAGE' ? result.value + '%' : '₹' + result.value} Discount Applied`);
        setDiscountApplied(true);
      }
    } catch (err: any) {
      alert(err.message || 'Invalid Promo Code');
    }
  };

  const handleCompletePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setPaymentSuccess(true);

      // Update user in localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...currentUser, subscription_tier: 'PREMIUM' };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    }, 1800);
  };

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
          Get instant access to behavioral tracking, unlimited mock tests, and personalized study schedules designed for UPSC toppers.
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
                <span>10 Free PYQs per day</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
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
            disabled
            style={{
              marginTop: 32, padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
              cursor: 'not-allowed'
            }}
          >
            Current Plan
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

              <button
                onClick={() => {
                  setSelectedPlan(plan);
                  setFinalPriceCents(plan.price_cents);
                  setPromoCode('');
                  setDiscountApplied(false);
                  setDiscountLabel('');
                  setShowCheckout(true);
                }}
                style={{
                  marginTop: 32, padding: '16px', borderRadius: 'var(--radius)',
                  backgroundColor: index === 0 ? 'var(--accent-primary)' : 'var(--bg-card)', 
                  color: index === 0 ? 'var(--bg-card)' : 'var(--text-primary)', 
                  border: index !== 0 ? '1px solid var(--border-default)' : 'none',
                  fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: index === 0 ? '0 6px 20px var(--shadow-color-accent)' : 'none', transition: 'transform 0.2s'
                }}
              >
                <span>Upgrade to {plan.name}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          ))
        )}

      </div>

      {/* Payment Checkout Modal / Drawer */}
      {showCheckout && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            backgroundColor: '#0f1e3c', borderRadius: 'var(--radius)', border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)', width: '100%', maxWidth: 540, padding: 32,
            position: 'relative', color: 'var(--bg-card)'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowCheckout(false)}
              style={{
                position: 'absolute', top: 20, right: 20, background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer'
              }}
            >
              ✕
            </button>

            {paymentSuccess ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: 'var(--radius)', backgroundColor: 'rgba(34, 197, 94, 0.2)', border: '2px solid #22c55e', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                  <Check size={36} />
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0' }}>Payment Successful! 🎉</h3>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', margin: '0 0 20px 0' }}>
                  Welcome to ExamPlanner Pro Membership. All features unlocked!
                </p>
                <div style={{ fontSize: 13, color: '#60a5fa', fontWeight: 600 }}>Redirecting to your Dashboard...</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <ShieldCheck size={24} color="#60a5fa" />
                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Checkout Order Summary</h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Secure 256-bit Encrypted Transaction</p>
                  </div>
                </div>

                {/* Selected Plan Details */}
                {selectedPlan && (
                  <div style={{ padding: 16, borderRadius: 'var(--radius)', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>
                        {selectedPlan.name}
                      </span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>
                        {selectedPlan.currency === 'INR' ? '₹' : selectedPlan.currency}{finalPriceCents / 100}
                      </span>
                    </div>
                    {discountApplied && (
                      <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
                        {discountLabel}
                      </div>
                    )}
                  </div>
                )}

                {/* Promo Code Input */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Enter Promo Code (e.g. EXAMPLANNER2026)"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      disabled={discountApplied}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                        border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)',
                        color: 'var(--bg-card)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleApplyPromo}
                    disabled={discountApplied || !promoCode}
                    style={{
                      padding: '10px 16px', borderRadius: 'var(--radius)', border: 'none',
                      backgroundColor: discountApplied ? '#22c55e' : 'var(--primary-red)', color: '#FFF',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    {discountApplied ? 'Applied ✓' : 'Apply'}
                  </button>
                </div>

                {/* Payment Method Selector */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 10 }}>
                    Select Payment Method
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { id: 'upi', label: 'UPI / QR', icon: QrCode },
                      { id: 'card', label: 'Card', icon: CreditCard },
                      { id: 'netbanking', label: 'Banking', icon: Building2 }
                    ].map(method => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id as any)}
                        style={{
                          padding: '10px', borderRadius: 'var(--radius)',
                          border: `1px solid ${paymentMethod === method.id ? '#60a5fa' : 'rgba(255,255,255,0.1)'}`,
                          backgroundColor: paymentMethod === method.id ? 'rgba(var(--primary-red-rgb), 0.2)' : 'rgba(255,255,255,0.04)',
                          color: 'var(--bg-card)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        <method.icon size={16} />
                        <span>{method.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Method Specific Form */}
                {paymentMethod === 'upi' && (
                  <div style={{ marginBottom: 24, padding: 16, borderRadius: 'var(--radius)', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'rgba(255,255,255,0.8)' }}>
                      Enter VPA / UPI ID (GPay, PhonePe, Paytm):
                    </div>
                    <input
                      type="text"
                      placeholder="username@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 'var(--radius)',
                        border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.08)',
                        color: 'var(--bg-card)', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {/* Pay Action Button */}
                <button
                  onClick={handleCompletePayment}
                  disabled={isProcessing}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 'var(--radius)', border: 'none',
                    backgroundColor: 'var(--primary-red)', color: 'var(--bg-card)', fontSize: 15, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 16px rgba(var(--primary-red-rgb), 0.4)'
                  }}
                >
                  {isProcessing ? (
                    <span>Processing Payment...</span>
                  ) : (
                    <>
                      <Zap size={18} />
                      <span>Pay {selectedPlan?.currency === 'INR' ? '₹' : selectedPlan?.currency}{finalPriceCents / 100} & Activate {selectedPlan?.name}</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
