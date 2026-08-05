import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  
  useEffect(() => {
    document.title = 'Previous Year Questions - Exam Planner';
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', padding: '40px 24px', transition: 'background-color 0.2s ease' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ 
              width: 44, height: 44, borderRadius: 14, border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s ease',
              boxShadow: 'var(--shadow-color-base)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--text-secondary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-default)';
            }}
          >
             <Ico.ArrowLeft /> 
          </button>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Previous Year Questions
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '4px 0 0 0', fontWeight: 500 }}>
              Select a year to begin your practice session in the exam environment.
            </p>
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
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
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{
                    backgroundColor: y.attempts > 0 ? 'var(--success-bg)' : 'var(--accent-bg)',
                    color: y.attempts > 0 ? 'var(--success-primary)' : 'var(--accent-primary)',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                  }}>
                    {y.year}
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    <Ico.Book />
                  </div>
                </div>
                
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', lineHeight: 1.3 }}>
                  {y.title}
                </h3>
                
                <div style={{ display: 'flex', gap: 16, marginTop: 'auto', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                    <Ico.Target size={14} /> {y.totalQuestions} Qs
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                    <Ico.Clock size={14} /> {y.duration}
                  </div>
                </div>

                {y.attempts > 0 && (
                  <div style={{ 
                    marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Attempted {y.attempts} time{y.attempts > 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--success-primary)', fontWeight: 700 }}>
                      Score: {y.lastScore}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
