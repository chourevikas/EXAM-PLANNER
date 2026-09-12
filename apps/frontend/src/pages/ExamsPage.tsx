import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PublicLayout } from '../components/common/PublicLayout';

const EXAMS = [
  { name: 'UPSC CSE', description: 'Civil Services Examination', icon: '🏛️' },
  { name: 'MPSC', description: 'Maharashtra Public Service Commission', icon: '⛰️' },
  { name: 'UPPSC', description: 'Uttar Pradesh Public Service Commission', icon: '🌟' },
  { name: 'BPSC', description: 'Bihar Public Service Commission', icon: '🌿' },
  { name: 'SSC CGL', description: 'Staff Selection Commission - Combined Graduate Level', icon: '🏢' },
  { name: 'Banking PO', description: 'Probationary Officer Exams (SBI, IBPS)', icon: '🏦' },
  { name: 'Railways RRB', description: 'Railway Recruitment Board', icon: '🚆' },
  { name: 'NDA', description: 'National Defence Academy', icon: '⚔️' },
  { name: 'CDS', description: 'Combined Defence Services', icon: '🛡️' },
  { name: 'RBI Grade B', description: 'Reserve Bank of India Officer', icon: '💰' },
];

export function ExamsPage() {
  const navigate = useNavigate();

  const handleExamClick = (examName: string) => {
    // Generate a random subject/topic to start practice
    // This could be enhanced to pick from the actual syllabus of the exam
    navigate(`/guest-exam?exam=${encodeURIComponent(examName)}&locked=true`);
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section
        className="landing-section-padding"
        style={{
          background: 'var(--bg-body)',
          paddingTop: 'clamp(96px, 11vw, 128px)',
          textAlign: 'center',
        }}
      >
        <div className="landing-container">
          <div className="section-label" style={{ justifyContent: 'center' }}>
            <BookOpen size={14} /> Practice Exams
          </div>
          <h1 className="section-heading" style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>
            Choose Your Exam Target
          </h1>
          <p className="section-subheading" style={{ color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto 48px' }}>
            Select the exam you are preparing for and start practicing with AI-generated dynamic mock tests and previous year questions.
          </p>
        </div>
      </section>

      {/* Exam Cards Grid */}
      <section className="landing-section-padding" style={{ background: 'var(--bg-body)', paddingTop: 0 }}>
        <div
          className="landing-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 24,
            maxWidth: 1080,
            margin: '0 auto'
          }}
        >
          {EXAMS.map((exam) => (
            <div
              key={exam.name}
              onClick={() => handleExamClick(exam.name)}
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: 24,
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(var(--primary-red-rgb), 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.02)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 32 }}>{exam.icon}</span>
                <div 
                  style={{ 
                    padding: '4px 10px', 
                    borderRadius: 20, 
                    backgroundColor: 'var(--accent-bg)',
                    color: 'var(--accent-primary)',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Practice Now
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                  {exam.name}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  {exam.description}
                </p>
              </div>
              <div style={{ 
                marginTop: 'auto', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                fontSize: 14, 
                fontWeight: 600, 
                color: 'var(--text-main)' 
              }}>
                Start Engine <ArrowRight size={16} color="var(--accent-primary)" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
