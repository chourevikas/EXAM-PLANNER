import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';

const YEARS = [
  { year: 2023, title: 'UPSC CSE Prelims 2023', totalQuestions: 100, duration: '120 mins', attempts: 0 },
  { year: 2022, title: 'UPSC CSE Prelims 2022', totalQuestions: 100, duration: '120 mins', attempts: 1, lastScore: '112/200' },
  { year: 2021, title: 'UPSC CSE Prelims 2021', totalQuestions: 100, duration: '120 mins', attempts: 0 },
  { year: 2020, title: 'UPSC CSE Prelims 2020', totalQuestions: 100, duration: '120 mins', attempts: 2, lastScore: '108/200' },
  { year: 2019, title: 'UPSC CSE Prelims 2019', totalQuestions: 100, duration: '120 mins', attempts: 0 },
  { year: 2018, title: 'UPSC CSE Prelims 2018', totalQuestions: 100, duration: '120 mins', attempts: 0 },
  { year: 2017, title: 'UPSC CSE Prelims 2017', totalQuestions: 100, duration: '120 mins', attempts: 1, lastScore: '98/200' },
  { year: 2016, title: 'UPSC CSE Prelims 2016', totalQuestions: 100, duration: '120 mins', attempts: 0 },
];

export function PYQSelectionPage() {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  return (
    <StudentLayout pageTitle="Previous Year Questions">
      {/* Header Banner */}
      <section style={{ 
        marginBottom: 32, padding: 32, borderRadius: 24,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(245,158,11,0.06) 100%)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 20, marginBottom: 10, border: '1px solid var(--accent-border)' }}>
          <Ico.Book size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Authentic UPSC Archive</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Previous Year Papers</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Select a paper to launch the realistic exam engine with AI explanation support.</p>
      </section>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
        {YEARS.map((y) => (
          <Link 
            key={y.year} 
            to={`/exam/pyq_${y.year}`}
            style={{ textDecoration: 'none' }}
            onMouseEnter={() => setHoveredYear(y.year)}
            onMouseLeave={() => setHoveredYear(null)}
          >
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 20,
              border: `1px solid ${hoveredYear === y.year ? 'var(--accent-primary)' : 'var(--border-default)'}`,
              padding: '24px',
              boxShadow: hoveredYear === y.year ? '0 12px 30px var(--shadow-color-accent)' : '0 8px 24px var(--shadow-color-base)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: hoveredYear === y.year ? 'translateY(-4px)' : 'translateY(0)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{
                  backgroundColor: y.attempts > 0 ? 'var(--success-bg)' : 'var(--accent-bg)',
                  color: y.attempts > 0 ? 'var(--success-primary)' : 'var(--accent-primary)',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                }}>
                  {y.year} Paper
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  <Ico.Book size={20} />
                </div>
              </div>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', lineHeight: 1.3 }}>
                {y.title}
              </h3>
              
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, fontWeight: 500 }}>
                <span>{y.totalQuestions} Questions</span>
                <span>•</span>
                <span>{y.duration}</span>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: y.attempts > 0 ? 'var(--success-primary)' : 'var(--text-muted)' }}>
                  {y.attempts > 0 ? `Score: ${y.lastScore}` : 'Not Attempted'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  Start <Ico.ArrowRight size={14} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </StudentLayout>
  );
}
