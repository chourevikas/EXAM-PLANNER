import React from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { PerformanceAnalyticsCharts } from '../components/student/PerformanceAnalyticsCharts';
import { Ico } from '../components/common/Icons';

export function AnalyticsPage() {
  return (
    <StudentLayout pageTitle="Deep Analytics">
      {/* Header Banner */}
      <section style={{ 
        marginBottom: 32, padding: 32, borderRadius: 24,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(37,99,235,0.06) 100%)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 20, marginBottom: 10, border: '1px solid var(--accent-border)' }}>
          <Ico.Chart size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Performance Intelligence</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Detailed Analytics Dashboard</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Comprehensive breakdown of your speed, topic accuracy, and mistake patterns.</p>
      </section>

      {/* Main Charts */}
      <PerformanceAnalyticsCharts />

      {/* Additional Analytics Breakdown */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 32 }}>
        
        {/* Speed vs Accuracy */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Speed vs. Accuracy Matrix</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Fast & Accurate</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--success-primary)' }}>54% of Questions</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Slow & Accurate</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-primary)' }}>28% of Questions</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Rushed & Incorrect</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger-primary)' }}>18% of Questions</span>
            </div>
          </div>
        </div>

        {/* Mistake Pattern */}
        <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Mistake Analysis</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Silly / Misread Errors</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--warning-primary)' }}>12 Errors</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Conceptual Gaps</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--danger-primary)' }}>24 Errors</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 14, backgroundColor: 'var(--bg-subtle)', borderRadius: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Time Crunch Pressure</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--info-primary)' }}>6 Errors</span>
            </div>
          </div>
        </div>

      </section>
    </StudentLayout>
  );
}
