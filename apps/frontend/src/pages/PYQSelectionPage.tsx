import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { Ico } from '../components/common/Icons';
import { listExams, listCandidateAttempts, ExamItem, AttemptHistoryItem, formatCanonicalExamTitle } from '../services/examService';
import { CheckCircle2, PlayCircle, BarChart2, RotateCcw } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

interface DisplayExam {
  id: number | string;
  code: string;
  year: number | string;
  title: string;
  totalQuestions: number;
  duration: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  completedAttemptId?: number | string;
  inProgressAttemptId?: number | string;
  scoreText?: string;
}

export function PYQSelectionPage() {
  const [hoveredExam, setHoveredExam] = useState<number | string | null>(null);
  const [examsList, setExamsList] = useState<DisplayExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken } = useAuth();

  useEffect(() => {
    async function fetchLiveExamsAndAttempts() {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (token) {
          localStorage.setItem('access_token', token);
        }
        const [liveExams, userAttempts] = await Promise.all([
          listExams('PUBLISHED', true, token || undefined),
          listCandidateAttempts(token || undefined),
        ]);

        // Only display exams that have been Approved & Published by Admin with is_active = True
        const publishedPyqs = liveExams.filter(
          (e) => e.is_active === true && (e.status === 'PUBLISHED' || e.status === 'ExamStatus.PUBLISHED')
        );

        if (publishedPyqs.length > 0) {
          const mapped: DisplayExam[] = publishedPyqs.map((e) => {
            // Find attempts for this exam and sort by newest first
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
              code: e.code,
              year: e.source_year || 2025,
              title: formatCanonicalExamTitle(e),
              totalQuestions: 100,
              duration: `${e.total_duration_minutes || 120} mins`,
              status,
              completedAttemptId: completedAttempt?.attempt_id,
              inProgressAttemptId: inProgressAttempt?.attempt_id,
              scoreText,
            };
          });
          setExamsList(mapped);
        } else {
          setExamsList([]);
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
        marginBottom: 32, padding: 32, borderRadius: 0,
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-color-base)',
        backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(245,158,11,0.06) 100%)'
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: 'var(--accent-bg)', borderRadius: 0, marginBottom: 10, border: '1px solid var(--accent-border)' }}>
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
      ) : examsList.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: 0, border: '1px solid var(--border-default)' }}>
          <div style={{ margin: '0 auto 12px auto', opacity: 0.5 }}>
            <Ico.Book size={40} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>No Approved PYQ Papers Available Yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Previous year exam papers uploaded to S3 will appear here as soon as they are approved & published by an administrator.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {examsList.map((exam) => {
            const hasCompleted = Boolean(exam.completedAttemptId);
            const hasInProgress = Boolean(exam.inProgressAttemptId);

            return (
              <div 
                key={exam.id} 
                onMouseEnter={() => setHoveredExam(exam.id)}
                onMouseLeave={() => setHoveredExam(null)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 0,
                  border: `1px solid ${hoveredExam === exam.id ? '#E31B23' : hasCompleted ? '#A7F3D0' : '#E2E8F0'}`,
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '22px 24px',
                  boxShadow: hoveredExam === exam.id
                    ? '0 8px 20px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)'
                    : '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
                  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: hoveredExam === exam.id ? 'translateY(-3px)' : 'translateY(0)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                }}
              >
                {/* Top Edge Accent Line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    backgroundColor: '#E31B23',
                    transform: hoveredExam === exam.id ? 'scaleX(1)' : 'scaleX(0)',
                    transformOrigin: 'left center',
                    transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{
                      backgroundColor: hasInProgress ? 'rgba(245,158,11,0.12)' : hasCompleted ? 'rgba(16,185,129,0.12)' : 'var(--accent-bg)',
                      color: hasInProgress ? '#F2B623' : hasCompleted ? '#3A8B53' : 'var(--accent-primary)',
                      padding: '6px 12px',
                      borderRadius: 0,
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      {hasInProgress ? (
                        <StatusBadge status="in-progress" label="In Progress" size="sm" />
                      ) : hasCompleted ? (
                        <StatusBadge status="completed" label="Exam Completed" size="sm" />
                      ) : (
                        <StatusBadge status="pyq" label={`${exam.year} Paper`} size="sm" />
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

                  {hasCompleted && exam.scoreText && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 0, backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 13, color: '#3A8B53', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Report Ready</span>
                      <span>Score: {exam.scoreText}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border-default)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  {hasInProgress ? (
                    <>
                      <Link 
                        to={`/exam/${exam.id}?type=PYQ`}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 0,
                          backgroundColor: '#F2B623',
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
                          to={`/analytics?attemptId=${exam.completedAttemptId}`}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 0,
                            backgroundColor: '#E31B23',
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
                        to={`/exam/${exam.id}?forceNew=true&type=PYQ`}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 0,
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
                        title="Start Fresh Attempt"
                      >
                        <RotateCcw size={14} /> Retake
                      </Link>
                    </>
                  ) : hasCompleted ? (
                    <>
                      <Link 
                        to={`/analytics?attemptId=${exam.completedAttemptId}`}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: 0,
                          backgroundColor: '#E31B23',
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
                        to={`/exam/${exam.id}?forceNew=true&type=PYQ`}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 0,
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
                        title="Start Exam Again"
                      >
                        <RotateCcw size={14} /> Retake
                      </Link>
                    </>
                  ) : (
                    <Link 
                      to={`/exam/${exam.id}?type=PYQ`}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 0,
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
