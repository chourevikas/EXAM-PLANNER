import React from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  TrendingUp,
  BarChart2,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface AdminOverviewViewProps {
  onNavigate: (view: string) => void;
}

export function AdminOverviewView({ onNavigate }: AdminOverviewViewProps) {
  const metrics = [
    { title: 'Total Papers Uploaded', value: '24', badge: '+4 this month', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', icon: Upload },
    { title: 'Questions Extracted', value: '2,400', badge: '100% Parsed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: FileText },
    { title: 'AI Extraction Accuracy', value: '94.2%', badge: 'High Confidence', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', icon: Sparkles },
    { title: 'Supported Exam Types', value: '8', badge: 'UPSC / State PSC', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: Layers },
  ];

  const recentUploads = [
    { title: 'UPSC Civil Services Prelims 2024 (GS Paper I)', questions: 100, date: 'Today, 2:30 PM', status: 'Ready for Review', confidence: 96.2 },
    { title: 'UPSC CAPF AC Prelims 2023 (Paper I)', questions: 125, date: 'Yesterday', status: 'Approved & Published', confidence: 98.1 },
    { title: 'MPPSC State Services 2023 (GS Paper I)', questions: 100, date: 'Jul 28, 2026', status: 'Approved & Published', confidence: 91.5 },
  ];

  const subjectBreakdown = [
    { subject: 'Polity & Governance', count: 520, percent: 22, color: '#2563eb' },
    { subject: 'History & Culture', count: 480, percent: 20, color: '#8b5cf6' },
    { subject: 'Geography & Environment', count: 430, percent: 18, color: '#10b981' },
    { subject: 'Economy & Development', count: 390, percent: 16, color: '#f59e0b' },
    { subject: 'Science & Technology', count: 350, percent: 14, color: '#06b6d4' },
    { subject: 'Current Affairs', count: 230, percent: 10, color: '#ec4899' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--color-navy-950, #07112a) 0%, #1e293b 100%)',
          borderRadius: 20,
          padding: 32,
          color: '#fff',
          marginBottom: 28,
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--font-mono)' }}>
            ⚙️ CONTENT & EXAM OPERATIONS
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, margin: '6px 0 0 0', letterSpacing: '-0.5px' }}>
            Admin Dashboard Overview
          </h1>
          <p style={{ fontSize: 15, color: '#94a3b8', marginTop: 6, maxWidth: 600 }}>
            Upload exam PDFs to S3 storage, run AI question extraction pipelines, and verify question bank metadata.
          </p>
        </div>

        <button
          onClick={() => onNavigate('upload')}
          className="btn btn-primary"
          style={{
            padding: '12px 24px',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)',
          }}
        >
          <Upload size={18} />
          <span>Upload New Exam PDF</span>
        </button>
      </div>

      {/* 4 Executive Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 28 }}>
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div
              key={i}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 18,
                padding: 24,
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={m.color} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: m.color, background: m.bg, padding: '3px 10px', borderRadius: 99, fontFamily: 'var(--font-mono)' }}>
                  {m.badge}
                </span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: 'var(--text-main)' }}>{m.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>{m.title}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Recent Activity & Subject Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Recent Uploads Feed */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 28, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-main)', margin: 0 }}>
                Recent Exam Paper Uploads
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Latest question papers processed through S3 and AI extraction.
              </p>
            </div>
            <button onClick={() => onNavigate('upload')} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 13 }}>
              View All <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {recentUploads.map((paper, i) => (
              <div
                key={i}
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-body)' }}>
                    {paper.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {paper.questions} Questions • Uploaded {paper.date}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 10px', borderRadius: 99, fontFamily: 'var(--font-mono)' }}>
                    {paper.confidence}% AI Conf.
                  </span>
                  <button onClick={() => onNavigate('upload')} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Question Distribution by Subject */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 28, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-main)', margin: '0 0 4px' }}>
            Question Distribution
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Extracted question breakdown by subject category.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {subjectBreakdown.map((item, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  <span>{item.subject}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{item.count} ({item.percent}%)</span>
                </div>
                <div style={{ height: 7, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.percent * 3.5}%`, background: item.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
