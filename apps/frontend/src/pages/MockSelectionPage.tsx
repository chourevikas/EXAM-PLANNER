import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ico } from '../components/common/Icons';

const MOCKS = [
  { id: 'mock_full_1', title: 'Full Length UPSC Mock 1', category: 'Full Length', totalQuestions: 100, duration: '120 mins', attempts: 1, lastScore: '112/200' },
  { id: 'mock_full_2', title: 'Full Length UPSC Mock 2', category: 'Full Length', totalQuestions: 100, duration: '120 mins', attempts: 0 },
  { id: 'mock_polity_1', title: 'Sectional Mock: Polity & Governance', category: 'Sectional', totalQuestions: 50, duration: '60 mins', attempts: 0 },
  { id: 'mock_eco_1', title: 'Sectional Mock: Indian Economy', category: 'Sectional', totalQuestions: 50, duration: '60 mins', attempts: 2, lastScore: '74/100' },
  { id: 'mock_geo_1', title: 'Sectional Mock: Geography & Env.', category: 'Sectional', totalQuestions: 50, duration: '60 mins', attempts: 0 },
  { id: 'mock_full_3', title: 'Full Length UPSC Mock 3', category: 'Full Length', totalQuestions: 100, duration: '120 mins', attempts: 0 },
];

export function MockSelectionPage() {
  const navigate = useNavigate();
  const [hoveredMock, setHoveredMock] = useState<string | null>(null);
  
  useEffect(() => {
    document.title = 'Mock Tests - Exam Planner';
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
              Mock Tests
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '4px 0 0 0', fontWeight: 500 }}>
              Select a mock test to evaluate your preparation and get AI psychometric insights.
            </p>
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
          {MOCKS.map((mock) => (
            <Link 
              key={mock.id} 
              to={`/exam/${mock.id}`}
              style={{ textDecoration: 'none' }}
              onMouseEnter={() => setHoveredMock(mock.id)}
              onMouseLeave={() => setHoveredMock(null)}
            >
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 20,
                border: `1px solid ${hoveredMock === mock.id ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                padding: '24px',
                boxShadow: hoveredMock === mock.id ? '0 12px 30px var(--shadow-color-accent)' : '0 8px 24px var(--shadow-color-base)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hoveredMock === mock.id ? 'translateY(-4px)' : 'translateY(0)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{
                    backgroundColor: mock.attempts > 0 ? 'var(--success-bg)' : (mock.category === 'Full Length' ? 'var(--accent-bg)' : 'var(--pink-bg)'),
                    color: mock.attempts > 0 ? 'var(--success-primary)' : (mock.category === 'Full Length' ? 'var(--accent-primary)' : 'var(--pink-primary)'),
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {mock.attempts > 0 ? 'Completed' : mock.category}
                  </div>
                  <div style={{ color: mock.attempts > 0 ? 'var(--success-primary)' : 'var(--text-muted)' }}>
                    {mock.attempts > 0 ? <Ico.Check /> : <Ico.Target />}
                  </div>
                </div>
                
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', lineHeight: 1.3 }}>
                  {mock.title}
                </h3>
                
                <div style={{ display: 'flex', gap: 16, marginTop: 'auto', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                    <Ico.Target size={14} /> {mock.totalQuestions} Qs
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                    <Ico.Clock size={14} /> {mock.duration}
                  </div>
                </div>

                {mock.attempts > 0 ? (
                  <div style={{ 
                    marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Attempted {mock.attempts} time{mock.attempts > 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--success-primary)', fontWeight: 700 }}>
                      Score: {mock.lastScore}
                    </span>
                  </div>
                ) : (
                  <div style={{ 
                    marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 14, color: 'var(--accent-primary)', fontWeight: 700 }}>
                      Start Exam →
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
