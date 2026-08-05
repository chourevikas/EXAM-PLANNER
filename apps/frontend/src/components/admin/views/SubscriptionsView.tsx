import React from 'react';
import { CreditCard, CheckCircle2, Zap, DollarSign } from 'lucide-react';

export function SubscriptionsView() {
  const plans = [
    { name: 'UPSC Aspirant Free', price: '₹0', period: 'Forever Free', features: ['5 Mock Tests', 'Basic PYQs', 'Community Support'], users: '12,400 Students' },
    { name: 'UPSC Pro Pass', price: '₹499', period: 'per month', features: ['Unlimited Mock Tests', 'AI Question Hints', 'Detailed Analytics', 'S3 Question Bank'], users: '1,840 Active Subscribers' },
    { name: 'Institution / Coaching', price: '₹4,999', period: 'per year', features: ['Custom Question Papers', 'Bulk PDF Uploads', 'Admin Dashboard Access', 'Dedicated Support'], users: '24 Institutions' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-main)', margin: 0 }}>
                Subscriptions & Billing Plans
              </h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              Manage student subscription tiers, pricing plans, and revenue metrics.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {plans.map((p, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{p.name}</h3>
                <div style={{ margin: '14px 0' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-display)' }}>{p.price}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6, fontFamily: 'var(--font-mono)' }}>{p.period}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {p.features.map((f, idx) => (
                    <div key={idx} style={{ fontSize: 13, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={14} color="#10b981" /> {f}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: 12, fontWeight: 700, color: 'var(--royal)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                {p.users}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
