import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { listExams, listCandidateAttempts, ExamItem, AttemptHistoryItem, formatCanonicalExamTitle } from '../services/examService';
import { CheckCircle2, PlayCircle, BarChart2, RotateCcw } from 'lucide-react';

interface DisplayMock {
  id: string;
  title: string;
  category: string;
  totalQuestions: number;
  duration: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  completedAttemptId?: string;
  inProgressAttemptId?: string;
  scoreText?: string;
}

export function MockSelectionPage() {
  const [hoveredMock, setHoveredMock] = useState<string | null>(null);
  const [mocksList, setMocksList] = useState<DisplayMock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveMocksAndAttempts() {
      setIsLoading(true);
      try {
        const [liveExams, userAttempts] = await Promise.all([
          listExams(undefined, true),
          listCandidateAttempts(),
        ]);

        const mocks = liveExams.filter(
          (e) => e.is_active === true && (e.exam_type === 'STATIC_MOCK' || e.exam_type === 'QuestionSourceType.STATIC_MOCK')
        );

        const targetList = mocks.length > 0 ? mocks : liveExams.filter((e) => e.is_active === true);

        if (targetList.length > 0) {
          const mapped: DisplayMock[] = targetList.map((e) => {
            const examAttempts = userAttempts.filter(
              (att) => att.exam_id === e.id || att.exam_id === e.code
            );
            examAttempts.sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime());

            const completedAttempt = examAttempts.find((att) =>
              ['COMPLETED', 'SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(att.status)
            );
            const inProgressAttempt = examAttempts.find((att) => att.status === 'IN_PROGRESS');

            let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
            let scoreText: string | undefined = undefined;

            if (inProgressAttempt) {
              status = 'IN_PROGRESS';
            } else if (completedAttempt) {
              status = 'COMPLETED';
            }

            if (completedAttempt) {
              scoreText = `${completedAttempt.total_score} / ${completedAttempt.max_possible_score}`;
            }

            return {
              id: e.id,
              title: formatCanonicalExamTitle(e),
              category: e.stage || 'Full Length',
              totalQuestions: 100,
              duration: `${e.total_duration_minutes || 120} mins`,
              status,
              completedAttemptId: completedAttempt?.attempt_id,
              inProgressAttemptId: inProgressAttempt?.attempt_id,
              scoreText,
            };
          });
          setMocksList(mapped);
        } else {
          setMocksList([]);
        }
      } catch (err) {
        console.warn('Failed to load real-time mocks & attempts:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLiveMocksAndAttempts();
  }, []);

  return (
    <StudentLayout pageTitle="Mock Tests">
      {/* Header Banner */}
      <section style={{ 
        marginBottom: 32, padding: 32, borderRadius: 24,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(219,39,119,0.06) 100%)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 20, marginBottom: 10, border: '1px solid var(--accent-border)' }}>
          <Ico.Book size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Adaptive Testing</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>UPSC Mock Tests</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Practice with real test conditions, instant scoring, and psychometric feedback.</p>
      </section>

      {/* Grid */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ marginBottom: 12 }} />
          Fetching real-time mock test archive and attempt status...
        </div>
      ) : mocksList.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-default)' }}>
          <div style={{ margin: '0 auto 12px auto', opacity: 0.5 }}>
            <Ico.Book size={40} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Approved Mock Tests Available Yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Mock tests uploaded will appear here as soon as they are published by an administrator.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {mocksList.map((mock) => {
            const hasCompleted = Boolean(mock.completedAttemptId);
            const hasInProgress = Boolean(mock.inProgressAttemptId);

            return (
              <div 
                key={mock.id} 
                onMouseEnter={() => setHoveredMock(mock.id)}
                onMouseLeave={() => setHoveredMock(null)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 20,
                  border: `1px solid ${hoveredMock === mock.id ? 'var(--accent-primary)' : hasCompleted ? 'rgba(16,185,129,0.3)' : 'var(--border-default)'}`,
                  padding: '24px',
                  boxShadow: hoveredMock === mock.id ? '0 12px 30px var(--shadow-color-accent)' : '0 8px 24px var(--shadow-color-base)',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: hoveredMock === mock.id ? 'translateY(-4px)' : 'translateY(0)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{
                      backgroundColor: hasInProgress ? 'rgba(245,158,11,0.12)' : hasCompleted ? 'rgba(16,185,129,0.12)' : 'var(--accent-bg)',
                      color: hasInProgress ? '#f59e0b' : hasCompleted ? '#10b981' : 'var(--accent-primary)',
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      {hasInProgress ? (
                        <>
                          <PlayCircle size={14} /> In Progress
                        </>
                      ) : hasCompleted ? (
                        <>
                          <CheckCircle2 size={14} /> Completed
                        </>
                      ) : (
                        <>
                          {mock.category}
                        </>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-muted)' }}>
                      <Ico.Book size={20} />
                    </div>
                  </div>
                  
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0', lineHeight: 1.3 }}>
                    {mock.title}
                  </h3>
                  
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                    <span>{mock.totalQuestions} Questions</span>
                    <span>•</span>
                    <span>{mock.duration}</span>
                  </div>

                  {hasCompleted && mock.scoreText && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 13, color: '#10b981', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Report Ready</span>
                      <span>Score: {mock.scoreText}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border-default)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  {hasInProgress ? (
                    <>
                      <Link 
                        to={`/exam/${mock.id}`}
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
                        <PlayCircle size={16} /> Resume
                      </Link>

                      {hasCompleted && (
                        <Link 
                          to={`/analytics?attemptId=${mock.completedAttemptId}`}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 12,
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          title="View Previous Report"
                        >
                          <BarChart2 size={16} /> Report
                        </Link>
                      )}

                      <Link 
                        to={`/exam/${mock.id}?forceNew=true`}
                        style={{
                          padding: '10px 12px',
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
                        title="Start Fresh Test"
                      >
                        <RotateCcw size={14} /> Retake
                      </Link>
                    </>
                  ) : hasCompleted ? (
                    <>
                      <Link 
                        to={`/analytics?attemptId=${mock.completedAttemptId}`}
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
                        to={`/exam/${mock.id}?forceNew=true`}
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
                        title="Retake Test"
                      >
                        <RotateCcw size={14} /> Retake
                      </Link>
                    </>
                  ) : (
                    <Link 
                      to={`/exam/${mock.id}`}
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
                      Start Test <Ico.ArrowRight size={14} />
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
