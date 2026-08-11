import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { listExams, listCandidateAttempts, ExamItem, AttemptHistoryItem } from '../services/examService';
import { CheckCircle2, PlayCircle, BarChart2, RotateCcw } from 'lucide-react';

interface DisplayExam {
  id: string;
  code: string;
  year: number | string;
  title: string;
  totalQuestions: number;
  duration: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  latestAttemptId?: string;
  scoreText?: string;
}

export function PYQSelectionPage() {
  const [hoveredExam, setHoveredExam] = useState<string | null>(null);
  const [examsList, setExamsList] = useState<DisplayExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveExamsAndAttempts() {
      setIsLoading(true);
      try {
        const [liveExams, userAttempts] = await Promise.all([
          listExams(),
          listCandidateAttempts(),
        ]);

        const pyqs = liveExams.filter(
          (e) => !e.exam_type || e.exam_type === 'PYQ' || e.exam_type === 'QuestionSourceType.PYQ'
        );

        if (pyqs.length > 0) {
          const mapped: DisplayExam[] = pyqs.map((e) => {
            // Find latest attempt for this exam
            const matchingAttempt = userAttempts.find(
              (att) => att.exam_id === e.id || att.exam_id === e.code
            );

            let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
            let scoreText: string | undefined = undefined;
            let latestAttemptId: string | undefined = undefined;

            if (matchingAttempt) {
              latestAttemptId = matchingAttempt.attempt_id;
              if (
                matchingAttempt.status === 'COMPLETED' ||
                matchingAttempt.status === 'SUBMITTED' ||
                matchingAttempt.status === 'AUTO_SUBMITTED' ||
                matchingAttempt.status === 'EVALUATED'
              ) {
                status = 'COMPLETED';
                scoreText = `${matchingAttempt.total_score} / ${matchingAttempt.max_possible_score}`;
              } else if (matchingAttempt.status === 'IN_PROGRESS') {
                status = 'IN_PROGRESS';
              }
            }

            return {
              id: e.id,
              code: e.code,
              year: e.source_year || 2023,
              title: e.name || e.code,
              totalQuestions: 100,
              duration: `${e.total_duration_minutes || 120} mins`,
              status,
              latestAttemptId,
              scoreText,
            };
          });
          setExamsList(mapped);
        } else {
          // Default fallback if no exams stored yet
          setExamsList([
            { id: 'upsc_cse-prelims-gs1-2023-A', code: 'upsc_cse-prelims-gs1-2023-A', year: 2023, title: 'UPSC CSE Prelims 2023', totalQuestions: 100, duration: '120 mins', status: 'NOT_STARTED' },
            { id: 'pyq_2022', code: 'pyq_2022', year: 2022, title: 'UPSC CSE Prelims 2022', totalQuestions: 100, duration: '120 mins', status: 'NOT_STARTED' },
          ]);
        }
      } catch (err) {
        console.warn('Failed to load real-time exams & attempts from API:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLiveExamsAndAttempts();
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
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Select an active paper to attempt or view your generated psychometric diagnostic report.</p>
      </section>

      {/* Grid */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ marginBottom: 12 }} />
          Fetching real-time exam archive and attempt status...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {examsList.map((exam) => {
            const isCompleted = exam.status === 'COMPLETED';
            const isInProgress = exam.status === 'IN_PROGRESS';

            return (
              <div 
                key={exam.id} 
                onMouseEnter={() => setHoveredExam(exam.id)}
                onMouseLeave={() => setHoveredExam(null)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 20,
                  border: `1px solid ${hoveredExam === exam.id ? 'var(--accent-primary)' : isCompleted ? 'rgba(16,185,129,0.3)' : 'var(--border-default)'}`,
                  padding: '24px',
                  boxShadow: hoveredExam === exam.id ? '0 12px 30px var(--shadow-color-accent)' : '0 8px 24px var(--shadow-color-base)',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: hoveredExam === exam.id ? 'translateY(-4px)' : 'translateY(0)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{
                      backgroundColor: isCompleted ? 'rgba(16,185,129,0.12)' : isInProgress ? 'rgba(245,158,11,0.12)' : 'var(--accent-bg)',
                      color: isCompleted ? '#10b981' : isInProgress ? '#f59e0b' : 'var(--accent-primary)',
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      {isCompleted ? (
                        <>
                          <CheckCircle2 size={14} /> Exam Completed
                        </>
                      ) : isInProgress ? (
                        <>
                          <PlayCircle size={14} /> In Progress
                        </>
                      ) : (
                        <>
                          {exam.year} Paper
                        </>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      <Ico.Book size={20} />
                    </div>
                  </div>
                  
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0', lineHeight: 1.3 }}>
                    {exam.title}
                  </h3>
                  
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                    <span>{exam.totalQuestions} Questions</span>
                    <span>•</span>
                    <span>{exam.duration}</span>
                  </div>

                  {isCompleted && exam.scoreText && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 13, color: '#10b981', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Report Ready</span>
                      <span>Score: {exam.scoreText}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border-default)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  {isCompleted ? (
                    <>
                      <Link 
                        to={`/analytics?attemptId=${exam.latestAttemptId}`}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 12,
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: 13,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          textAlign: 'center',
                        }}
                      >
                        <BarChart2 size={16} /> View Report
                      </Link>

                      <Link 
                        to={`/exam/${exam.id}`}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 12,
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: 13,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          border: '1px solid var(--border-default)',
                        }}
                        title="Retake Exam"
                      >
                        <RotateCcw size={14} /> Retake
                      </Link>
                    </>
                  ) : isInProgress ? (
                    <Link 
                      to={`/exam/${exam.id}`}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 12,
                        backgroundColor: '#f59e0b',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        textAlign: 'center',
                      }}
                    >
                      <PlayCircle size={16} /> Resume Exam
                    </Link>
                  ) : (
                    <Link 
                      to={`/exam/${exam.id}`}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 12,
                        backgroundColor: 'var(--accent-primary)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        textAlign: 'center',
                      }}
                    >
                      Start Exam <Ico.ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StudentLayout>
  );
}
