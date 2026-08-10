import React from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';

export function WeeklyInsightsPage() {
  return (
    <StudentLayout pageTitle="Weekly Insights">
      {/* Header Banner */}
      <section style={{ 
        marginBottom: 32, padding: 32, borderRadius: 24,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(219,39,119,0.06) 0%, rgba(91,92,235,0.06) 100%)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--pink-bg)', borderRadius: 20, marginBottom: 10 }}>
          <Ico.Sparkles size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pink-primary)', textTransform: 'uppercase' }}>Weekly AI Executive Summary</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Weekly Performance Report</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>AI-generated weekly review for Aug 3 - Aug 9, 2026.</p>
      </section>

      {/* Grid of Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        
        {/* Card 1: Key Achievements */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 8, backgroundColor: 'var(--success-bg)', color: 'var(--success-primary)', borderRadius: 10 }}>
              <Ico.Trophy size={18} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Weekly Highlights</h3>
          </div>
          <ul style={{ paddingLeft: 20, margin: 0, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li>Completed 42 PYQs with 78% average accuracy.</li>
            <li>Maintained 14-day study streak (+3 days growth).</li>
            <li>Polity accuracy improved from 60% to 72%.</li>
          </ul>
        </div>

        {/* Card 2: Recommended Revision */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 8, backgroundColor: 'var(--warning-bg)', color: 'var(--warning-primary)', borderRadius: 10 }}>
              <Ico.Brain size={18} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Focus Next Week</h3>
          </div>
          <ul style={{ paddingLeft: 20, margin: 0, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li>Revise Indian Economy (Inflation & Monetary Policy).</li>
            <li>Attempt 2 Full-length Mock Tests for time management.</li>
            <li>Solve 20 PYQs on Physical Geography.</li>
          </ul>
        </div>

      </div>
    </StudentLayout>
  );
}
