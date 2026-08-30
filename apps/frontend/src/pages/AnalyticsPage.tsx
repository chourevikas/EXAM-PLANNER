import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { PerformanceAnalyticsCharts } from '../components/student/PerformanceAnalyticsCharts';
import { PsychometricReportView } from '../components/student/PsychometricReportView';
import { Ico } from '../components/common/Icons';
import {
  getPsychometricReportJson,
  getAttemptQuestionReport,
  getAttemptUserProgressionReport,
  listCandidateAttempts,
  getAttemptEvaluationStatus,
  pollAttemptReportUntilReady,
  retryAttemptEvaluation,
  getUserCumulativeAggregateReport,
  AttemptHistoryItem,
} from '../services/examService';
import { PsychometricReport, QuestionReportItem, UserProgressionReportData } from '../types/exam';
import { Loader2, FileCheck, Sparkles, Cpu, Activity, RefreshCw, AlertCircle, ArrowLeft, BarChart3 } from 'lucide-react';
import { useMinimumLoadingTime } from '../hooks/useMinimumLoadingTime';
import { PerformanceAnalyticsSkeleton } from '../components/student/PerformanceAnalyticsSkeleton';

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const attemptIdParam = searchParams.get('attemptId');

  const [attemptsHistory, setAttemptsHistory] = useState<AttemptHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;
  // Default to CUMULATIVE_ALL unless a specific attemptId is requested
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | string>(attemptIdParam || 'CUMULATIVE_ALL');
  const [report, setReport] = useState<PsychometricReport | null>(null);
  const [questionReportData, setQuestionReportData] = useState<QuestionReportItem[]>([]);
  const [userProgressionData, setUserProgressionData] = useState<UserProgressionReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState(25);
  const [evalMessage, setEvalMessage] = useState('Evaluating responses...');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryEvaluation = async () => {
    if (!selectedAttemptId || selectedAttemptId === 'CUMULATIVE_ALL') return;
    setIsRetrying(true);
    setError(null);
    try {
      await retryAttemptEvaluation(selectedAttemptId);
      setReloadTrigger((prev) => prev + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger evaluation retry.');
    } finally {
      setIsRetrying(false);
    }
  };

  // 1. Fetch user's attempt history on mount
  useEffect(() => {
    async function loadAttemptHistory() {
      setIsHistoryLoading(true);
      try {
        const history = await listCandidateAttempts();
        const completed = history.filter(
          (a) => a.status === 'COMPLETED' || a.status === 'EVALUATED' || a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED' || a.status === 'FAILED'
        );
        setAttemptsHistory(completed);
      } catch (err) {
        console.warn('Failed to load candidate attempt history for analytics page:', err);
      } finally {
        setIsHistoryLoading(false);
      }
    }

    loadAttemptHistory();
  }, []);

  // Sync selectedAttemptId when searchParams change
  useEffect(() => {
    if (attemptIdParam) {
      setSelectedAttemptId(attemptIdParam);
    } else {
      setSelectedAttemptId('CUMULATIVE_ALL');
    }
  }, [attemptIdParam]);

  // 2. Fetch specific reports whenever selectedAttemptId changes
  useEffect(() => {
    const targetId = selectedAttemptId || 'CUMULATIVE_ALL';
    let isCancelled = false;

    async function fetchReportWithPolling() {
      setIsLoading(true);
      setError(null);

      // Handle All Exams Cumulative Profile
      if (targetId === 'CUMULATIVE_ALL') {
        try {
          const cumRep = await getUserCumulativeAggregateReport();
          if (isCancelled) return;
          if (cumRep) {
            setReport(cumRep);
          } else {
            setError('Failed to synthesize cumulative report.');
          }
          setQuestionReportData([]);
          setUserProgressionData(null);
        } catch (err: any) {
          if (!isCancelled) setError(err.message || 'Failed to load cumulative report.');
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
            setIsEvaluating(false);
          }
        }
        return;
      }

      try {
        // Step 1: Check status via lightweight polling endpoint
        const initialStatus = await getAttemptEvaluationStatus(targetId);

        if (initialStatus && (initialStatus.is_failed || initialStatus.status === 'FAILED')) {
          setError(initialStatus.message || 'Psychometric evaluation failed for this attempt. Please click Retry below to re-evaluate.');
          setIsEvaluating(false);
          setIsLoading(false);
          return;
        }

        if (initialStatus && !initialStatus.is_ready && initialStatus.status !== 'COMPLETED' && initialStatus.status !== 'EVALUATED') {
          setIsEvaluating(true);
          setEvalProgress(initialStatus.progress_percentage || 40);
          setEvalMessage(initialStatus.message || 'Synthesizing 11 psychometric matrices & smart mentor recommendations...');

          // Long-polling loop (every 1.5s)
          const isReady = await pollAttemptReportUntilReady(
            targetId,
            (statusUpdate) => {
              if (isCancelled) return;
              setEvalProgress(statusUpdate.progress_percentage || 60);
              setEvalMessage(statusUpdate.message || 'Computing knowledge ability and decay curves...');
            },
            200,
            1500
          );

          if (isCancelled) return;
          setIsEvaluating(false);

          if (!isReady) {
            const checkLatest = await getAttemptEvaluationStatus(targetId);
            if (checkLatest && (checkLatest.is_failed || checkLatest.status === 'FAILED')) {
              setError(checkLatest.message || 'Psychometric evaluation failed. Please click Retry below.');
            } else {
              setError('The psychometric evaluation is taking longer than expected. You can click Retry or refresh later.');
            }
            setIsLoading(false);
            return;
          }
        } else {
          setIsEvaluating(false);
        }

        // Step 2: Fetch structured JSON reports in parallel (no raw markdown calls)
        const [jsonRes, qRes, progRes] = await Promise.allSettled([
          getPsychometricReportJson(targetId),
          getAttemptQuestionReport(targetId),
          getAttemptUserProgressionReport(targetId),
        ]);

        if (isCancelled) return;

        if (jsonRes.status === 'fulfilled') {
          const loadedReport = jsonRes.value;
          setReport(loadedReport);

          // If Phase 2 AI Mentorship is still synthesizing in background, poll silently with backoff until resolved
          if (targetId !== 'CUMULATIVE_ALL' && !loadedReport?.llm_insight) {
            let attempts = 0;
            const maxAttempts = 10; // Poll up to 10 times (max ~25 seconds)
            const pollIntervalMs = 3500;

            const pollAiInsight = async () => {
              if (isCancelled || attempts >= maxAttempts) return;
              attempts++;
              try {
                const refreshedReport = await getPsychometricReportJson(targetId);
                if (refreshedReport && refreshedReport.llm_insight && !isCancelled) {
                  setReport((prev) => (prev ? { ...prev, llm_insight: refreshedReport.llm_insight } : refreshedReport));
                  return; // Resolved successfully
                }
              } catch {
                // Silent catch - will retry next interval
              }

              if (!isCancelled && attempts < maxAttempts) {
                setTimeout(pollAiInsight, pollIntervalMs);
              }
            };

            setTimeout(pollAiInsight, 2000);
          }
        } else {
          setError(jsonRes.reason?.message || 'Report is currently compiling in background. Please refresh in a moment.');
        }

        if (qRes.status === 'fulfilled' && qRes.value?.questions) {
          setQuestionReportData(qRes.value.questions);
        }

        if (progRes.status === 'fulfilled') {
          setUserProgressionData(progRes.value);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load psychometric report.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsEvaluating(false);
        }
      }
    }

    fetchReportWithPolling();

    return () => {
      isCancelled = true;
    };
  }, [selectedAttemptId, reloadTrigger]);

  const handleSelectAttempt = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (newId) {
      setSelectedAttemptId(newId);
      if (newId === 'CUMULATIVE_ALL') {
        setSearchParams({});
      } else {
        setSearchParams({ attemptId: newId });
      }
    }
  };

  const handleViewSingleExam = (attemptId: number | string) => {
    setSelectedAttemptId(attemptId);
    setSearchParams({ attemptId: String(attemptId) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToCumulative = () => {
    setSelectedAttemptId('CUMULATIVE_ALL');
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <StudentLayout pageTitle="Deep Analytics">
      {/* Single Exam Mode Back Banner */}
      {selectedAttemptId !== 'CUMULATIVE_ALL' && (
        <div
          style={{
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderRadius: 0,
            backgroundColor: 'rgba(227, 27, 35, 0.08)',
            border: '1px solid rgba(227, 27, 35, 0.25)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>Viewing Individual Exam Report:</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#E31B23' }}>
              {attemptsHistory.find((a) => a.attempt_id === selectedAttemptId)?.exam_name || 'Selected Exam Paper'}
            </span>
          </div>

          <button
            onClick={handleBackToCumulative}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 0,
              backgroundColor: '#E31B23',
              color: '#ffffff',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(227, 27, 35, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowLeft size={16} />
            <span>← Back to Cumulative User Report</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <section
        style={{
          marginBottom: 24,
          padding: 32,
          borderRadius: 0,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-color-base)',
          backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(227, 27, 35,0.06) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              backgroundColor: 'var(--accent-bg)',
              borderRadius: 0,
              marginBottom: 10,
              border: '1px solid var(--accent-border)',
            }}
          >
            <Ico.Chart size={14} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              {selectedAttemptId === 'CUMULATIVE_ALL' ? 'Cumulative Longitudinal Master Report' : 'Single Exam Psychometric Diagnostic'}
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            {selectedAttemptId === 'CUMULATIVE_ALL' ? 'Cumulative Student Performance & Mastery Profile' : 'Exam Performance & Cognitive Diagnostic'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            {selectedAttemptId === 'CUMULATIVE_ALL'
              ? 'Multi-exam weighted synthesis across all completed tests with AI contextual diagnosis, subject mastery, and actionable study plans.'
              : 'Detailed question-by-question breakdown, macro scores, and AI mentorship guidance for this completed test.'}
          </p>
        </div>

        {/* Back to Master Cumulative Overview Button (When viewing single exam) */}
        {selectedAttemptId !== 'CUMULATIVE_ALL' && (
          <button
            onClick={handleBackToCumulative}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 0,
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--accent-primary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-color-base)',
              transition: 'all 0.2s ease',
            }}
          >
            <BarChart3 size={16} color="#E31B23" />
            ← Back to Master Cumulative Report
          </button>
        )}
      </section>

      {/* Per-Exam Attempt Switcher (When viewing an individual exam that has multiple attempts) */}
      {(() => {
        if (selectedAttemptId === 'CUMULATIVE_ALL') return null;
        const currentAtt = attemptsHistory.find((a) => a.attempt_id === selectedAttemptId);
        if (!currentAtt) return null;
        const sameExamAttempts = attemptsHistory.filter(
          (a) => a.exam_id === currentAtt.exam_id || a.exam_name === currentAtt.exam_name
        );
        if (sameExamAttempts.length <= 1) return null;

        return (
          <div
            style={{
              marginBottom: 20,
              padding: '14px 20px',
              borderRadius: 0,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-color-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                🔄 Multiple Attempts Found for this Exam ({sameExamAttempts.length} Total):
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Switch Attempt:</span>
              <select
                value={selectedAttemptId}
                onChange={(e) => handleViewSingleExam(e.target.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 0,
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid #E31B23',
                  color: 'var(--text-primary)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {sameExamAttempts.map((att, idx) => (
                  <option key={att.attempt_id} value={att.attempt_id}>
                    Attempt #{sameExamAttempts.length - idx} • {new Date(att.started_at).toLocaleDateString()} — Score: {att.total_score}/{att.max_possible_score}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })()}

      {/* No Exams Taken Empty State Screen */}
      {!isHistoryLoading && attemptsHistory.length === 0 ? (
        <div
          style={{
            padding: '64px 32px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 0,
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-color-base)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            maxWidth: 640,
            margin: '40px auto',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 0,
              backgroundColor: 'rgba(227, 27, 35, 0.1)',
              border: '1px solid rgba(227, 27, 35, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
            }}
          >
            📊
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            No Exam Analytics Available Yet
          </h2>

          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 500, margin: 0 }}>
            You haven't completed any practice tests or mock exams yet. Take your first exam to unlock deep AI Performance Analytics, Subject Mastery Heatmaps, Speed-Accuracy Matrix, and AIR Rank Predictions!
          </p>

          <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => (window.location.href = '/practice-exam')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 28px',
                borderRadius: 0,
                backgroundColor: '#E31B23',
                color: '#ffffff',
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(227, 27, 35, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>✍️ Take Practice Exam Now</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Completed Exam History Quick-Access Table (When in Cumulative Mode) */}
          {selectedAttemptId === 'CUMULATIVE_ALL' && attemptsHistory.length > 0 && (
            <section
              style={{
                marginBottom: 24,
                padding: 24,
                borderRadius: 0,
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-color-base)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={18} color="#E31B23" /> Completed Exam Papers ({attemptsHistory.length} Total Attempts)
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
                    Click "View Exam Report" on any exam below to inspect its individual question solutions, cognitive breakdown, and metrics.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-default)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>#</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Exam Paper & Attempt</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Mode</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Date</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Marks Scored / Max Marks</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>Questions</th>
                      <th style={{ padding: '10px 12px', color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totalPages = Math.ceil(attemptsHistory.length / historyPageSize) || 1;
                      const validPage = Math.min(Math.max(1, historyPage), totalPages);
                      const startIndex = (validPage - 1) * historyPageSize;
                      const paginated = attemptsHistory.slice(startIndex, startIndex + historyPageSize);

                      return paginated.map((att, idx) => {
                        const globalIdx = startIndex + idx;
                        const sameExamList = attemptsHistory.filter((a) => a.exam_id === att.exam_id || a.exam_name === att.exam_name);
                        const attemptIndex = sameExamList.findIndex((a) => a.attempt_id === att.attempt_id);
                        const attemptNum = sameExamList.length - attemptIndex;

                        return (
                          <tr
                            key={att.attempt_id}
                            style={{
                              borderBottom: '1px solid var(--border-default)',
                            }}
                          >
                            <td style={{ padding: '12px', fontWeight: 800, color: '#E31B23' }}>{globalIdx + 1}</td>
                            <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span>{att.exam_name}</span>
                                {sameExamList.length > 1 && (
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 800,
                                      padding: '2px 7px',
                                      borderRadius: 0,
                                      backgroundColor: 'rgba(227, 27, 35, 0.12)',
                                      color: '#E31B23',
                                      border: '1px solid rgba(227, 27, 35, 0.25)',
                                    }}
                                  >
                                    Attempt #{attemptNum}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 0,
                                  backgroundColor: att.mode === 'FULL_MOCK' ? 'rgba(227, 27, 35, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                  color: att.mode === 'FULL_MOCK' ? '#E31B23' : '#3A8B53',
                                }}
                              >
                                {att.mode.replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                              {new Date(att.started_at).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                              <span style={{ color: Number(att.total_score) >= 92 ? '#3A8B53' : '#E31B23' }}>
                                {att.total_score}
                              </span>{' '}
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {att.max_possible_score} Marks</span>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                              {att.total_questions} Questions
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleViewSingleExam(att.attempt_id)}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: 0,
                                  backgroundColor: '#E31B23',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 8px rgba(227, 27, 35, 0.2)',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                View Exam Report →
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {attemptsHistory.length > historyPageSize && (() => {
                const totalPages = Math.ceil(attemptsHistory.length / historyPageSize);
                const startItem = (historyPage - 1) * historyPageSize + 1;
                const endItem = Math.min(historyPage * historyPageSize, attemptsHistory.length);

                return (
                  <div
                    style={{
                      marginTop: 18,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      paddingTop: 14,
                      borderTop: '1px solid var(--border-default)',
                    }}
                  >
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      Showing <strong style={{ color: 'var(--text-primary)' }}>{startItem} - {endItem}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{attemptsHistory.length}</strong> attempts
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 0,
                          border: '1px solid var(--border-default)',
                          backgroundColor: historyPage <= 1 ? 'transparent' : 'var(--bg-subtle)',
                          color: historyPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: historyPage <= 1 ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: historyPage <= 1 ? 0.5 : 1,
                        }}
                      >
                        ← Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={`page_${pageNum}`}
                          onClick={() => setHistoryPage(pageNum)}
                          style={{
                            padding: '6px 11px',
                            borderRadius: 0,
                            border: pageNum === historyPage ? '1px solid #E31B23' : '1px solid var(--border-default)',
                            backgroundColor: pageNum === historyPage ? '#E31B23' : 'var(--bg-subtle)',
                            color: pageNum === historyPage ? '#ffffff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        disabled={historyPage >= totalPages}
                        onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 0,
                          border: '1px solid var(--border-default)',
                          backgroundColor: historyPage >= totalPages ? 'transparent' : 'var(--bg-subtle)',
                          color: historyPage >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: historyPage >= totalPages ? 'not-allowed' : 'pointer',
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: historyPage >= totalPages ? 0.5 : 1,
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          {/* Long-Polling Evaluation State (Zero Deployment Timeout Guarantee) */}
          {isEvaluating && (
            <div
              style={{
                padding: 32,
                marginBottom: 28,
                borderRadius: 0,
                backgroundColor: 'var(--bg-card)',
                border: '2px solid rgba(227, 27, 35, 0.3)',
                boxShadow: '0 8px 32px rgba(227, 27, 35, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#E31B23' }}>
                <Cpu size={28} className="animate-spin" />
                <Sparkles size={24} color="#8b5cf6" />
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Psychometric Evaluation Engine Active
              </h2>

              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, maxWidth: 520 }}>
                {evalMessage}
              </p>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: 480,
                  height: 8,
                  borderRadius: 0,
                  backgroundColor: 'var(--bg-subtle)',
                  overflow: 'hidden',
                  marginTop: 6,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${evalProgress}%`,
                    background: 'linear-gradient(90deg, #E31B23, #8b5cf6)',
                    borderRadius: 0,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                Polling live diagnostics ({evalProgress}% Complete)
              </span>
            </div>
          )}

          {/* Loading Skeleton */}
          {useMinimumLoadingTime(isLoading && !isEvaluating, 400) && (
            <div style={{ marginTop: 16 }}>
              <PerformanceAnalyticsSkeleton />
            </div>
          )}

          {/* Error / Processing Banner */}
          {error && !isEvaluating && (
            <div
              style={{
                padding: '20px 24px',
                borderRadius: 0,
                backgroundColor: 'rgba(227, 27, 35, 0.1)',
                border: '1px solid rgba(227, 27, 35, 0.3)',
                color: 'var(--text-primary)',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
                <AlertCircle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                  <strong style={{ color: '#ef4444' }}>Evaluation Notice: </strong>
                  <span>{error}</span>
                </div>
              </div>

              {selectedAttemptId && selectedAttemptId !== 'CUMULATIVE_ALL' && (
                <button
                  onClick={handleRetryEvaluation}
                  disabled={isRetrying}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    borderRadius: 0,
                    backgroundColor: '#E31B23',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isRetrying ? 'not-allowed' : 'pointer',
                    opacity: isRetrying ? 0.7 : 1,
                    boxShadow: '0 4px 12px rgba(227, 27, 35, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                  <span>{isRetrying ? 'Retrying Evaluation...' : 'Retry Evaluation'}</span>
                </button>
              )}
            </div>
          )}

          {/* Live Saved Psychometric Report View */}
          {report ? (
            <PsychometricReportView
              report={report}
              questionReportData={questionReportData}
              userProgressionData={userProgressionData}
            />
          ) : (
            !isLoading && !isEvaluating && (
              <div
                style={{
                  padding: 48,
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 0,
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-color-base)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  maxWidth: 680,
                  margin: '32px auto',
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 0,
                    backgroundColor: 'rgba(227, 27, 35, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    fontSize: 28,
                  }}
                >
                  ⚠️
                </div>

                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Unable to Generate Report
                </h2>

                <p style={{ fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 520, margin: 0 }}>
                  No evaluated telemetry or psychometric data is available for this exam attempt yet. Complete and submit a practice exam or mock test to generate your 12-matrix diagnostic report.
                </p>

                <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 0,
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    ↻ Refresh Analysis
                  </button>

                  <button
                    type="button"
                    onClick={() => (window.location.href = '/practice')}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 0,
                      border: 'none',
                      backgroundColor: 'var(--accent-primary, #E31B23)',
                      color: '#ffffff',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(227, 27, 35, 0.3)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Take a Practice Exam →
                  </button>
                </div>
              </div>
            )
          )}
        </>
      )}
    </StudentLayout>
  );
}
