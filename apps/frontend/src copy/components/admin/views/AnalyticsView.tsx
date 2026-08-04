import React from 'react';
import { BarChart2, TrendingUp, Sparkles, Target, Users, BookOpen } from 'lucide-react';

export function AnalyticsView() {
  const metrics = [
    { title: 'Total Student Attempts', value: '14,280', growth: '+18% this week', color: '#2563eb' },
    { title: 'Avg Question Accuracy', value: '64.8%', growth: '+2.4% MoM', color: '#10b981' },
    { title: 'AI Extraction Precision', value: '94.2%', growth: 'High Accuracy', color: '#8b5cf6' },
    { title: 'Active Test Takers', value: '1,840', growth: 'Live Now', color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-main)', margin: 0 }}>
                Reports & Platform Analytics
              </h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              Student performance metrics, weak topic diagnostics, and AI question extraction confidence analytics.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 22 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.growth}</span>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--text-main)', margin: '6px 0 2px' }}>{m.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{m.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
