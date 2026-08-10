import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
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
  const [hoveredMock, setHoveredMock] = useState<string | null>(null);

  return (
    <StudentLayout pageTitle="Mock Tests">
      {/* Header Banner */}
      <section style={{ 
        marginBottom: 32, padding: 32, borderRadius: 24,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(219,39,119,0.06) 100%)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--pink-bg)', borderRadius: 20, marginBottom: 10 }}>
          <Ico.Brain size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pink-primary)', textTransform: 'uppercase' }}>AI-Powered Exam Simulation</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Mock Test Series</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Select a full-length or sectional mock test to get AI psychometric behavioral tracking.</p>
      </section>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
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
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{
                  backgroundColor: mock.category === 'Full Length' ? 'var(--accent-bg)' : 'var(--warning-bg)',
                  color: mock.category === 'Full Length' ? 'var(--accent-primary)' : 'var(--warning-primary)',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                }}>
                  {mock.category}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  <Ico.Brain size={20} />
                </div>
              </div>
              
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', lineHeight: 1.3 }}>
                {mock.title}
              </h3>
              
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, fontWeight: 500 }}>
                <span>{mock.totalQuestions} Questions</span>
                <span>•</span>
                <span>{mock.duration}</span>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: mock.attempts > 0 ? 'var(--success-primary)' : 'var(--text-muted)' }}>
                  {mock.attempts > 0 ? `Score: ${mock.lastScore}` : 'Not Attempted'}
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
