import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { listExams, ExamItem } from '../services/examService';

interface DisplayExam {
  id: string;
  code: string;
  year: number | string;
  title: string;
  totalQuestions: number;
  duration: string;
  attempts: number;
  lastScore?: string;
}

export function PYQSelectionPage() {
  const [hoveredExam, setHoveredExam] = useState<string | null>(null);
  const [examsList, setExamsList] = useState<DisplayExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveExams() {
      setIsLoading(true);
      try {
        const liveExams = await listExams();
        const pyqs = liveExams.filter(
          (e) => !e.exam_type || e.exam_type === 'PYQ' || e.exam_type === 'QuestionSourceType.PYQ'
        );

        if (pyqs.length > 0) {
          const mapped: DisplayExam[] = pyqs.map((e) => ({
            id: e.id,
            code: e.code,
            year: e.source_year || 2023,
            title: e.name || e.code,
            totalQuestions: 100,
            duration: `${e.total_duration_minutes || 120} mins`,
            attempts: 0,
          }));
          setExamsList(mapped);
        } else {
          // Default fallback
          setExamsList([
            { id: 'upsc_cse-prelims-gs1-2023-A', code: 'upsc_cse-prelims-gs1-2023-A', year: 2023, title: 'UPSC CSE Prelims 2023', totalQuestions: 100, duration: '120 mins', attempts: 0 },
            { id: 'pyq_2022', code: 'pyq_2022', year: 2022, title: 'UPSC CSE Prelims 2022', totalQuestions: 100, duration: '120 mins', attempts: 0 },
          ]);
        }
      } catch (err) {
        console.warn('Failed to load exams from API, using fallback:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLiveExams();
  }, []);

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
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Select an active paper stored in system database to launch the realistic exam engine.</p>
      </section>

      {/* Grid */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ marginBottom: 12 }} />
          Loading active exam papers from database storage...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
          {examsList.map((exam) => (
            <Link 
              key={exam.id} 
              to={`/exam/${exam.id}`}
              style={{ textDecoration: 'none' }}
              onMouseEnter={() => setHoveredExam(exam.id)}
              onMouseLeave={() => setHoveredExam(null)}
            >
              <div style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 20,
                border: `1px solid ${hoveredExam === exam.id ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                padding: '24px',
                boxShadow: hoveredExam === exam.id ? '0 12px 30px var(--shadow-color-accent)' : '0 8px 24px var(--shadow-color-base)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: hoveredExam === exam.id ? 'translateY(-4px)' : 'translateY(0)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{
                    backgroundColor: exam.attempts > 0 ? 'var(--success-bg)' : 'var(--accent-bg)',
                    color: exam.attempts > 0 ? 'var(--success-primary)' : 'var(--accent-primary)',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                  }}>
                    {exam.year} Paper
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    <Ico.Book size={20} />
                  </div>
                </div>
                
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', lineHeight: 1.3 }}>
                  {exam.title}
                </h3>
                
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, fontWeight: 500 }}>
                  <span>{exam.totalQuestions} Questions</span>
                  <span>•</span>
                  <span>{exam.duration}</span>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: exam.attempts > 0 ? 'var(--success-primary)' : 'var(--text-muted)' }}>
                    {exam.attempts > 0 ? `Score: ${exam.lastScore}` : 'Available'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Start <Ico.ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </StudentLayout>
  );
}
