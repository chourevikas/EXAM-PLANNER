import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { PerformanceAnalyticsCharts } from '../components/student/PerformanceAnalyticsCharts';
import { PsychometricReportView } from '../components/student/PsychometricReportView';
import { Ico } from '../components/common/Icons';
import {
  getPsychometricReportJson,
  getPsychometricReportMarkdown,
  getAttemptQuestionReport,
  getAttemptUserProgressionReport,
  listCandidateAttempts,
  getAttemptEvaluationStatus,
  pollAttemptReportUntilReady,
  AttemptHistoryItem,
} from '../services/examService';
import { PsychometricReport, QuestionReportItem, UserProgressionReportData } from '../types/exam';
import { Loader2, FileCheck, Sparkles, Cpu, Activity } from 'lucide-react';

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const attemptIdParam = searchParams.get('attemptId');

  const [attemptsHistory, setAttemptsHistory] = useState<AttemptHistoryItem[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(attemptIdParam);
  const [report, setReport] = useState<PsychometricReport | null>(null);
  const [markdown, setMarkdown] = useState<string | undefined>(undefined);
  const [questionReportData, setQuestionReportData] = useState<QuestionReportItem[]>([]);
  const [userProgressionData, setUserProgressionData] = useState<UserProgressionReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState(25);
  const [evalMessage, setEvalMessage] = useState('Evaluating responses...');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch user's attempt history on mount
  useEffect(() => {
    async function loadAttemptHistory() {
      setIsHistoryLoading(true);
      try {
        const history = await listCandidateAttempts();
        const completed = history.filter(
          (a) => a.status === 'COMPLETED' || a.status === 'EVALUATED' || a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED'
        );
        setAttemptsHistory(completed);

        // If no attemptId in URL, auto-select the latest completed attempt
        if (!attemptIdParam && completed.length > 0) {
          const latest = completed[0].attempt_id;
          setSelectedAttemptId(latest);
          setSearchParams({ attemptId: latest });
        }
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
    }
  }, [attemptIdParam]);

  // 2. Fetch specific reports whenever selectedAttemptId changes with Long-Polling
  useEffect(() => {
    if (!selectedAttemptId) return;
    const targetId = selectedAttemptId;
    let isCancelled = false;

    async function fetchReportWithPolling() {
      setIsLoading(true);
      setError(null);

      // Handle All Exams Cumulative Profile
      if (targetId === 'CUMULATIVE_ALL') {
        try {
          const { getUserCumulativeAggregateReport, getUserCumulativeAggregateMarkdown } = await import('../services/examService');
          const [cumRep, cumMd] = await Promise.allSettled([
            getUserCumulativeAggregateReport(),
            getUserCumulativeAggregateMarkdown(),
          ]);
          if (isCancelled) return;
          if (cumRep.status === 'fulfilled') {
            setReport(cumRep.value);
          } else {
            setError(cumRep.reason?.message || 'Failed to synthesize cumulative report.');
          }
          if (cumMd.status === 'fulfilled') {
            setMarkdown(cumMd.value);
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
        if (initialStatus && !initialStatus.is_ready && initialStatus.status !== 'COMPLETED' && initialStatus.status !== 'EVALUATED') {
          setIsEvaluating(true);
          setEvalProgress(initialStatus.progress_percentage || 40);
          setEvalMessage(initialStatus.message || 'Synthesizing 12 psychometric matrices & smart mentor recommendations...');

          // Long-polling loop (every 1.5s)
          const isReady = await pollAttemptReportUntilReady(
            targetId,
            (statusUpdate) => {
              if (isCancelled) return;
              setEvalProgress(statusUpdate.progress_percentage || 60);
              setEvalMessage(statusUpdate.message || 'Computing IRT 3PL ability and FSRS decay curves...');
            },
            200, // Increased to 300 seconds (5 mins)
            1500
          );

          if (isCancelled) return;
          setIsEvaluating(false);

          if (!isReady) {
            console.warn('[AnalyticsPage:POLL_TIMEOUT] Polling threshold reached. Evaluation still in progress.');
            setError('The psychometric evaluation is taking longer than expected. You can safely leave this page and check back later.');
            setIsLoading(false);
            return; // Stop here, don't fetch incomplete reports
          }
        } else {
          setIsEvaluating(false);
        }

        // Step 2: Fetch all 4 complete reports in parallel once ready
        const [jsonRes, mdRes, qRes, progRes] = await Promise.allSettled([
          getPsychometricReportJson(targetId),
          getPsychometricReportMarkdown(targetId),
          getAttemptQuestionReport(targetId),
          getAttemptUserProgressionReport(targetId),
        ]);

        if (isCancelled) return;

        if (jsonRes.status === 'fulfilled') {
          setReport(jsonRes.value);
        } else {
          setError(jsonRes.reason?.message || 'Report is currently compiling in background. Please refresh in a moment.');
        }

        if (mdRes.status === 'fulfilled') {
          setMarkdown(mdRes.value);
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
  }, [selectedAttemptId]);

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

  return (
    <StudentLayout pageTitle="Deep Analytics">
      {/* Header Banner */}
      <section
        style={{
          marginBottom: 24,
          padding: 32,
          borderRadius: 24,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-color-base)',
          backgroundImage: 'linear-gradient(135deg, rgba(91,92,235,0.06) 0%, rgba(37,99,235,0.06) 100%)',
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
              borderRadius: 20,
              marginBottom: 10,
              border: '1px solid var(--accent-border)',
            }}
          >
            <Ico.Chart size={14} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              Psychometric Intelligence Archive
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            Detailed Psychometric & Cognitive Analytics
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Comprehensive breakdown of your speed, topic accuracy, IRT latent ability, and guessing risk.
          </p>
        </div>

        {/* Completed Exam Attempt Selector */}
        {attemptsHistory.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileCheck size={14} color="#10b981" /> Select Saved Completed Exam:
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedAttemptId || ''}
                onChange={handleSelectAttempt}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 14,
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  appearance: 'none',
                }}
              >
                <option value="CUMULATIVE_ALL">
                  🌟 All Exams Cumulative Performance (12-Matrix Aggregation & Cross-Exam Comparison)
                </option>
                {attemptsHistory.map((att) => (
                  <option key={att.attempt_id} value={att.attempt_id}>
                    {att.exam_name} ({new Date(att.started_at).toLocaleDateString()}) - Score: {att.total_score}/{att.max_possible_score}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* Long-Polling Evaluation State (Zero Deployment Timeout Guarantee) */}
      {isEvaluating && (
        <div
          style={{
            padding: 32,
            marginBottom: 28,
            borderRadius: 20,
            backgroundColor: 'var(--bg-card)',
            border: '2px solid rgba(37, 99, 235, 0.3)',
            boxShadow: '0 8px 32px rgba(37, 99, 235, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#2563eb' }}>
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
              borderRadius: 8,
              backgroundColor: 'var(--bg-subtle)',
              overflow: 'hidden',
              marginTop: 6,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${evalProgress}%`,
                background: 'linear-gradient(90deg, #2563eb, #8b5cf6)',
                borderRadius: 8,
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
            Polling live diagnostics ({evalProgress}% Complete)
          </span>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && !isEvaluating && (
        <div style={{ padding: 40, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Loader2 size={28} className="animate-spin" color="#2563eb" />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Loading 12 Psychometric Diagnostic Matrices...
          </span>
        </div>
      )}

      {/* Error / Processing Banner */}
      {error && !isEvaluating && (
        <div style={{ padding: 20, borderRadius: 16, backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#d97706', marginBottom: 24 }}>
          <strong>Notice: </strong> {error}
        </div>
      )}

      {/* Live Saved Psychometric Report View */}
      {report ? (
        <PsychometricReportView
          report={report}
          markdownContent={markdown}
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
              borderRadius: 24,
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
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
                  borderRadius: 12,
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
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: 'var(--accent-primary, #2563eb)',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                Take a Practice Exam &rarr;
              </button>
            </div>
          </div>
        )
      )}
    </StudentLayout>
  );
}
