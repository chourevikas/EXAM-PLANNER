import React from 'react';
import { GraduationCap, Plus, Calendar, Clock, Users, BookOpen } from 'lucide-react';

export function MockTestsView() {
  const tests = [
    { title: 'UPSC Prelims Full Mock Test 01', exam: 'UPSC Prelims 2026', questions: 100, duration: '120 mins', candidates: 1420, status: 'Active' },
    { title: 'Polity & Constitution Sectional Test', exam: 'UPSC Prelims 2026', questions: 50, duration: '60 mins', candidates: 980, status: 'Active' },
    { title: 'MPPSC State Services Full Length Test', exam: 'MPPSC Prelims 2026', questions: 100, duration: '120 mins', candidates: 650, status: 'Scheduled' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GraduationCap size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-main)', margin: 0 }}>
                Mock Test Series & Exam Papers
              </h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              Create full-length mock tests, sectional speed tests, and automated negative marking test series.
            </p>
          </div>

          <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Create New Test Series
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {tests.map((t, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 22 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.12)', padding: '3px 10px', borderRadius: 99, fontFamily: 'var(--font-mono)' }}>{t.exam}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', margin: '10px 0 14px' }}>{t.title}</h3>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span><BookOpen size={14} style={{ verticalAlign: 'middle' }} /> {t.questions} Qs</span>
                <span><Clock size={14} style={{ verticalAlign: 'middle' }} /> {t.duration}</span>
                <span><Users size={14} style={{ verticalAlign: 'middle' }} /> {t.candidates} users</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
