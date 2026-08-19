import React from 'react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';

export function MonthlyReportPage() {
  return (
    <StudentLayout pageTitle="Performance Rank & Monthly Report">
      {/* Header Banner */}
      <section style={{ 
        marginBottom: 32, padding: 32, borderRadius: 24,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(91,92,235,0.06) 100%)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--success-bg)', borderRadius: 20, marginBottom: 10 }}>
          <Ico.Trophy size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-primary)', textTransform: 'uppercase' }}>National Benchmarking</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Monthly Performance & National Rank</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Percentile growth curve and exam readiness index for August 2026.</p>
      </section>

      {/* Main Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
        
        <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Predicted All India Rank</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-primary)', marginBottom: 4 }}>#482</div>
          <div style={{ fontSize: 13, color: 'var(--success-primary)', fontWeight: 600 }}>↑ Top 2% among 24,000+ active aspirants</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Overall Percentile</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--success-primary)', marginBottom: 4 }}>98.2 %ile</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Up from 94.1 %ile last month</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: 28, borderRadius: 24, border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Exam Readiness Index</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--warning-primary)', marginBottom: 4 }}>84 / 100</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>High probability of clearing Prelims cutoff</div>
        </div>

      </div>
    </StudentLayout>
  );
}
