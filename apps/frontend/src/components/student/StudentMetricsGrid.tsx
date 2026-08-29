import React from 'react';
import { Ico } from '../common/Icons';

interface StudentMetricsGridProps {
  user: any;
}

export function StudentMetricsGrid({ user }: StudentMetricsGridProps) {
  const attempted = user?.free_questions_attempted ?? 42;

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
      
      {/* Metric 1: Questions Attempted */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 0, 
        border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions Attempted</span>
          <div style={{ width: 36, height: 36, borderRadius: 0, backgroundColor: 'var(--accent-bg)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico.Target size={18} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            {attempted} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/ 100 quota</span>
          </div>
          <div style={{ height: 6, width: '100%', backgroundColor: 'var(--bg-subtle)', borderRadius: 0, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min((attempted / 100) * 100, 100)}%`, height: '100%', backgroundColor: 'var(--accent-primary)', borderRadius: 0 }} />
          </div>
        </div>
      </div>

      {/* Metric 2: Study Streak */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 0, 
        border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Study Streak</span>
          <div style={{ width: 36, height: 36, borderRadius: 0, backgroundColor: 'var(--warning-bg)', color: 'var(--warning-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico.Fire size={18} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            14 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>Days</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--success-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>↑ +3 days longer than last week</span>
          </div>
        </div>
      </div>

      {/* Metric 3: Total XP & Level */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 0, 
        border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>XP & Rank Tier</span>
          <div style={{ width: 36, height: 36, borderRadius: 0, backgroundColor: 'var(--success-bg)', color: 'var(--success-icon)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico.Trophy size={18} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            2,450 <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>XP</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>
            Level 4 Achiever • Top Tier
          </div>
        </div>
      </div>

      {/* Metric 4: Predicted Percentile */}
      <div style={{ 
        backgroundColor: 'var(--bg-card)', padding: 24, borderRadius: 0, 
        border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-color-base)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Predicted Rank</span>
          <div style={{ width: 36, height: 36, borderRadius: 0, backgroundColor: 'var(--info-bg)', color: 'var(--info-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico.Chart />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            Top 8%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            92nd Percentile overall
          </div>
        </div>
      </div>
    </section>
  );
}
