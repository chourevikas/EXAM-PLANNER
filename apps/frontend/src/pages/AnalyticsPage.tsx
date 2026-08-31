import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import { PerformanceAnalyticsCharts } from '../components/student/PerformanceAnalyticsCharts';
import { PsychometricReportView } from '../components/student/PsychometricReportView';
import { Ico } from '../components/common/Icons';
import {
  getPsychometricReportJson,
  listCandidateAttempts,
  getAttemptEvaluationStatus,
  pollAttemptReportUntilReady,
  retryAttemptEvaluation,
  getUserCumulativeAggregateReport,
  AttemptHistoryItem,
} from '../services/examService';
import { PsychometricReport } from '../types/exam';
import { Loader2, FileCheck, Sparkles, Cpu, Activity, RefreshCw, AlertCircle, ArrowLeft, BarChart3 } from 'lucide-react';
import { useMinimumLoadingTime } from '../hooks/useMinimumLoadingTime';
import { PerformanceAnalyticsSkeleton } from '../components/student/PerformanceAnalyticsSkeleton';
import { formatEnum } from '../utils/formatEnum';

// ─── Static Style Constants (extracted from inline style={{...}} to avoid per-render allocation) ───

const backBannerStyle: React.CSSProperties = {
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
};

const backBannerInnerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const backBannerLabelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' };
const backBannerValueStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#E31B23' };

const headerSectionStyle: React.CSSProperties = {
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
};

const headerBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  backgroundColor: 'var(--accent-bg)',
  borderRadius: 0,
  marginBottom: 10,
  border: '1px solid var(--accent-border)',
};

const headerBadgeTextStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' };
const headerTitleStyle: React.CSSProperties = { fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' };
const headerDescStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text-muted)', margin: '0 0 10px 0' };
const hasAiWrapperStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 };

const aiBadgeLoadedStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  backgroundColor: '#ECFDF5',
  border: '1px solid #A7F3D0',
  borderRadius: 0,
  color: '#059669',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.03em',
};

const aiBadgePendingStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  backgroundColor: '#FEF3C7',
  border: '1px solid #FDE68A',
  borderRadius: 0,
  color: '#D97706',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.03em',
};

const attemptSwitcherStyle: React.CSSProperties = {
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
};

const attemptSwitcherLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const attemptSwitcherTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' };
const attemptSwitcherControlStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const attemptSwitcherHintStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)' };

const attemptSwitcherSelectStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 0,
  backgroundColor: 'var(--bg-subtle)',
  border: '1px solid #E31B23',
  color: 'var(--text-primary)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
};

const emptyStateContainerStyle: React.CSSProperties = {
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
};

const emptyStateIconStyle: React.CSSProperties = {
  width: 80,
  height: 80,
  borderRadius: 0,
  backgroundColor: 'rgba(227, 27, 35, 0.1)',
  border: '1px solid rgba(227, 27, 35, 0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 36,
};

const emptyStateTitleStyle: React.CSSProperties = { fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 };
const emptyStateDescStyle: React.CSSProperties = { fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 500, margin: 0 };
const emptyStateActionsStyle: React.CSSProperties = { display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' };

const emptyStateCTAStyle: React.CSSProperties = {
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
};

const historyTableSectionStyle: React.CSSProperties = {
  marginBottom: 24,
  padding: 24,
  borderRadius: 0,
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-color-base)',
};

const historyTableHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 };
const historyTableTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 };
const historyTableSubtitleStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--text-muted)', margin: 0 };
const tableContainerStyle: React.CSSProperties = { overflowX: 'auto' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const theadRowStyle: React.CSSProperties = { borderBottom: '2px solid var(--border-default)', textAlign: 'left' };
const thStyle: React.CSSProperties = { padding: '10px 12px', color: 'var(--text-muted)' };
const thRightStyle: React.CSSProperties = { padding: '10px 12px', color: 'var(--text-muted)', textAlign: 'right' };
const tbodyRowStyle: React.CSSProperties = { borderBottom: '1px solid var(--border-default)' };
const tdIndexStyle: React.CSSProperties = { padding: '12px', fontWeight: 800, color: '#E31B23' };
const tdNameStyle: React.CSSProperties = { padding: '12px', fontWeight: 700, color: 'var(--text-primary)' };
const tdNameInnerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };

const attemptBadgeStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  padding: '2px 7px',
  borderRadius: 0,
  backgroundColor: 'rgba(227, 27, 35, 0.12)',
  color: '#E31B23',
  border: '1px solid rgba(227, 27, 35, 0.25)',
};

const tdCellStyle: React.CSSProperties = { padding: '12px' };
const tdMutedStyle: React.CSSProperties = { padding: '12px', color: 'var(--text-muted)' };
const tdScoreStyle: React.CSSProperties = { padding: '12px', fontWeight: 800, color: 'var(--text-primary)' };
const tdScoreMaxStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)' };
const tdActionStyle: React.CSSProperties = { padding: '12px', textAlign: 'right' };

const viewReportBtnStyle: React.CSSProperties = {
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
};

const paginationWrapperStyle: React.CSSProperties = {
  marginTop: 18,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 12,
  paddingTop: 14,
  borderTop: '1px solid var(--border-default)',
};

const paginationInfoStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--text-muted)' };
const paginationControlsStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };

const evaluatingContainerStyle: React.CSSProperties = {
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
};

const evaluatingIconsStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, color: '#E31B23' };
const evaluatingTitleStyle: React.CSSProperties = { fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text-primary)' };
const evaluatingMsgStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text-muted)', margin: 0, maxWidth: 520 };

const progressBarOuterStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  height: 8,
  borderRadius: 0,
  backgroundColor: 'var(--bg-subtle)',
  overflow: 'hidden',
  marginTop: 6,
};

const evalLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#64748b' };

const errorBannerStyle: React.CSSProperties = {
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
};

const errorBannerContentStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 };
const errorBannerTextStyle: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.5 };
const errorBannerLabelStyle: React.CSSProperties = { color: '#ef4444' };

const retryBtnStyle: React.CSSProperties = {
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
  boxShadow: '0 4px 12px rgba(227, 27, 35, 0.25)',
  transition: 'all 0.15s ease',
};

const noReportContainerStyle: React.CSSProperties = {
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
};

const noReportIconStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 0,
  backgroundColor: 'rgba(227, 27, 35, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ef4444',
  fontSize: 28,
};

const noReportTitleStyle: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 };
const noReportDescStyle: React.CSSProperties = { fontSize: 14.5, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 520, margin: 0 };
const noReportActionsStyle: React.CSSProperties = { display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' };

const refreshBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 0,
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const practiceExamBtnStyle: React.CSSProperties = {
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
};

const skeletonWrapperStyle: React.CSSProperties = { marginTop: 16 };

// ─── Component ───

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const attemptIdParam = searchParams.get('attemptId');

  // Single source of truth: selectedAttemptId derived directly from searchParams
  const selectedAttemptId = attemptIdParam || 'CUMULATIVE_ALL';

  const [attemptsHistory, setAttemptsHistory] = useState<AttemptHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;
  const [report, setReport] = useState<PsychometricReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState(25);
  const [evalMessage, setEvalMessage] = useState('Evaluating responses...');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // ─── A. Memoized exam-attempt lookup map (O(1) instead of O(n) per lookup) ───
  const examAttemptsMap = useMemo(() => {
    const map = new Map<string, AttemptHistoryItem[]>();
    for (const att of attemptsHistory) {
      const key = String(att.exam_id);
      const existing = map.get(key);
      if (existing) {
        existing.push(att);
      } else {
        map.set(key, [att]);
      }
    }
    return map;
  }, [attemptsHistory]);

  // ─── B. Memoized pagination values (shared by table body + controls) ───
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(attemptsHistory.length / historyPageSize) || 1;
    const validPage = Math.min(Math.max(1, historyPage), totalPages);
    const startIndex = (validPage - 1) * historyPageSize;
    const paginatedItems = attemptsHistory.slice(startIndex, startIndex + historyPageSize);
    const startItem = startIndex + 1;
    const endItem = Math.min(validPage * historyPageSize, attemptsHistory.length);
    return { totalPages, validPage, startIndex, paginatedItems, startItem, endItem };
  }, [attemptsHistory, historyPage]);

  // ─── C. Memoized hasAi badge ───
  const hasAi = useMemo(() => {
    if (!report) return false;
    return Boolean(
      report?.llm_insight?.executive_summary ||
      (report as any)?.part_2_exam_macro_scorecard?.mentorship_insight?.executive_summary ||
      (report as any)?.part_3_aggregated_user_report?.mentorship_insight?.executive_summary ||
      ((report?.llm_insight?.study_plan_tasks || []).length > 0) ||
      (((report as any)?.part_2_exam_macro_scorecard?.actionable_tasks || []).length > 0) ||
      (((report as any)?.part_3_aggregated_user_report?.actionable_tasks || []).length > 0)
    );
  }, [report]);

  // ─── D. Memoized attempt switcher data ───
  const attemptSwitcherData = useMemo(() => {
    if (selectedAttemptId === 'CUMULATIVE_ALL') return null;
    const currentAtt = attemptsHistory.find((a) => String(a.attempt_id) === String(selectedAttemptId));
    if (!currentAtt) return null;
    const sameExamAttempts = examAttemptsMap.get(String(currentAtt.exam_id)) || [];
    if (sameExamAttempts.length <= 1) return null;
    return { currentAtt, sameExamAttempts };
  }, [selectedAttemptId, attemptsHistory, examAttemptsMap]);

  // ─── E. Navigation & action callbacks ───
  const handleRetryEvaluation = useCallback(async () => {
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
  }, [selectedAttemptId]);

  const handleViewSingleExam = useCallback((attemptId: number | string) => {
    setSearchParams({ attemptId: String(attemptId) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  const handleBackToCumulative = useCallback(() => {
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  // 1. Fetch user's attempt history on mount (using server-side status filter)
  useEffect(() => {
    async function loadAttemptHistory() {
      setIsHistoryLoading(true);
      try {
        const history = await listCandidateAttempts({ page: 1, limit: 100, status: 'SUBMITTED,EVALUATED' });
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

  // 2. Fetch specific reports whenever selectedAttemptId changes
  useEffect(() => {
    const targetId = selectedAttemptId || 'CUMULATIVE_ALL';
    let isCancelled = false;
    let aiPollTimeoutId: ReturnType<typeof setTimeout> | null = null;

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

      // Validate numeric attempt ID
      const numId = parseInt(String(targetId), 10);
      if (isNaN(numId)) {
        setError(`Invalid attempt ID '${targetId}'.`);
        setIsLoading(false);
        setIsEvaluating(false);
        return;
      }

      try {
        // Step 1: Check status via lightweight polling endpoint
        const initialStatus = await getAttemptEvaluationStatus(numId);

        if (initialStatus && (initialStatus.is_failed || initialStatus.status === 'FAILED')) {
          setError(initialStatus.message || 'Psychometric evaluation failed for this attempt. Please click Retry below to re-evaluate.');
          setIsEvaluating(false);
          setIsLoading(false);
          return;
        }

        if (initialStatus && !initialStatus.is_ready && initialStatus.status !== 'COMPLETED' && initialStatus.status !== 'EVALUATED') {
          setIsEvaluating(true);
          setEvalProgress(initialStatus.progress_percentage || 40);
          setEvalMessage(initialStatus.message || 'Synthesizing psychometric matrices & smart mentor recommendations...');

          // Long-polling loop with delay strictly AFTER previous response completes
          const isReady = await pollAttemptReportUntilReady(
            numId,
            (statusUpdate) => {
              if (isCancelled) return;
              setEvalProgress(statusUpdate.progress_percentage || 60);
              setEvalMessage(statusUpdate.message || 'Computing knowledge ability and decay curves...');
            },
            30,
            6000,
            () => isCancelled
          );

          if (isCancelled) return;
          setIsEvaluating(false);

          if (!isReady) {
            const checkLatest = await getAttemptEvaluationStatus(numId);
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

        // Step 2: Fetch structured JSON report in 1 single call (PsychometricReport includes part_1_per_question_analysis and macro metrics)
        const loadedReport = await getPsychometricReportJson(numId);

        if (isCancelled) return;

        if (loadedReport) {
          setReport(loadedReport);

          // If Phase 2 AI Mentorship is still synthesizing in background, poll silently with 6s interval after each response
          if (targetId !== 'CUMULATIVE_ALL' && !loadedReport?.llm_insight) {
            let attempts = 0;
            const maxAttempts = 10;
            const pollIntervalMs = 6000;

            const pollAiInsight = async () => {
              if (isCancelled || attempts >= maxAttempts) return;
              attempts++;
              try {
                const refreshedReport = await getPsychometricReportJson(numId);
                if (refreshedReport && refreshedReport.llm_insight && !isCancelled) {
                  setReport((prev) => (prev ? { ...prev, llm_insight: refreshedReport.llm_insight } : refreshedReport));
                  return; // Resolved successfully
                }
              } catch {
                // Silent catch - will retry next interval
              }

              if (!isCancelled && attempts < maxAttempts) {
                aiPollTimeoutId = setTimeout(pollAiInsight, pollIntervalMs);
              }
            };

            aiPollTimeoutId = setTimeout(pollAiInsight, pollIntervalMs);
          }
        } else {
          setError('Report is currently compiling in background. Please refresh in a moment.');
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
      // Clear any orphaned AI insight polling timeout
      if (aiPollTimeoutId !== null) {
        clearTimeout(aiPollTimeoutId);
      }
    };
  }, [selectedAttemptId, reloadTrigger]);

  // G. handleSelectAttempt removed — was dead code (never used in JSX)

  return (
    <StudentLayout pageTitle="Deep Analytics">
      {/* Single Exam Mode Back Banner */}
      {selectedAttemptId !== 'CUMULATIVE_ALL' && (
        <div style={backBannerStyle}>
          <div style={backBannerInnerStyle}>
            <span style={backBannerLabelStyle}>Viewing Individual Exam Report:</span>
            <span style={backBannerValueStyle}>
              {attemptsHistory.find((a) => a.attempt_id === selectedAttemptId)?.exam_name || 'Selected Exam Paper'}
            </span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <section style={headerSectionStyle}>
        <div>
          <div style={headerBadgeStyle}>
            <Ico.Chart size={14} />
            <span style={headerBadgeTextStyle}>
              {selectedAttemptId === 'CUMULATIVE_ALL' ? 'Cumulative Longitudinal Master Report' : 'Single Exam Psychometric Diagnostic'}
            </span>
          </div>
          <h1 style={headerTitleStyle}>
            {selectedAttemptId === 'CUMULATIVE_ALL' ? 'Cumulative Student Performance & Mastery Profile' : 'Exam Performance & Cognitive Diagnostic'}
          </h1>
          <p style={headerDescStyle}>
            {selectedAttemptId === 'CUMULATIVE_ALL'
              ? 'Multi-exam weighted synthesis across all completed tests with contextual diagnosis, subject mastery, and actionable study plans.'
              : 'Detailed question-by-question breakdown, macro scores, and mentorship guidance for this completed test.'}
          </p>

          {/* Diagnostic Data Loaded Sign Badge — C. uses memoized hasAi */}
          {!isLoading && (
            <div style={hasAiWrapperStyle}>
              {hasAi ? (
                <span style={aiBadgeLoadedStyle}>
                  <Sparkles size={14} color="#059669" />
                  Diagnostic Data: Loaded & Verified
                </span>
              ) : (
                <span style={aiBadgePendingStyle}>
                  <Loader2 size={14} className="animate-spin" color="#D97706" />
                  Diagnostic Data: Generating Insights...
                </span>
              )}
            </div>
          )}
        </div>


      </section>

      {/* Per-Exam Attempt Switcher — D. uses memoized attemptSwitcherData */}
      {attemptSwitcherData && (
        <div style={attemptSwitcherStyle}>
          <div style={attemptSwitcherLabelStyle}>
            <span style={attemptSwitcherTitleStyle}>
              🔄 Multiple Attempts Found for this Exam ({attemptSwitcherData.sameExamAttempts.length} Total):
            </span>
          </div>
          <div style={attemptSwitcherControlStyle}>
            <span style={attemptSwitcherHintStyle}>Switch Attempt:</span>
            <select
              value={selectedAttemptId}
              onChange={(e) => handleViewSingleExam(e.target.value)}
              style={attemptSwitcherSelectStyle}
            >
              {attemptSwitcherData.sameExamAttempts.map((att, idx) => (
                <option key={att.attempt_id} value={att.attempt_id}>
                  Attempt #{attemptSwitcherData.sameExamAttempts.length - idx} • {new Date(att.started_at).toLocaleDateString()} — Score: {att.total_score}/{att.max_possible_score}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* No Exams Taken Empty State Screen */}
      {!isHistoryLoading && attemptsHistory.length === 0 ? (
        <div style={emptyStateContainerStyle}>
          <div style={emptyStateIconStyle}>
            📊
          </div>

          <h2 style={emptyStateTitleStyle}>
            No Exam Analytics Available Yet
          </h2>

          <p style={emptyStateDescStyle}>
            You haven't completed any practice tests or mock exams yet. Take your first exam to unlock deep Performance Analytics, Subject Mastery Heatmaps, Speed-Accuracy Matrix, and AIR Rank Predictions!
          </p>

          <div style={emptyStateActionsStyle}>
            <button
              onClick={() => (window.location.href = '/practice-exam')}
              style={emptyStateCTAStyle}
            >
              <span>✍️ Take Practice Exam Now</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Completed Exam History Quick-Access Table (When in Cumulative Mode) */}
          {selectedAttemptId === 'CUMULATIVE_ALL' && attemptsHistory.length > 0 && (
            <section style={historyTableSectionStyle}>
              <div style={historyTableHeaderStyle}>
                <div>
                  <h3 style={historyTableTitleStyle}>
                    <BarChart3 size={18} color="#E31B23" /> Completed Exam Papers ({attemptsHistory.length} Total Attempts)
                  </h3>
                  <p style={historyTableSubtitleStyle}>
                    Click "View Exam Report" on any exam below to inspect its individual question solutions, cognitive breakdown, and metrics.
                  </p>
                </div>
              </div>

              <div style={tableContainerStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Exam Paper & Attempt</th>
                      <th style={thStyle}>Mode</th>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Marks Scored / Max Marks</th>
                      <th style={thStyle}>Questions</th>
                      <th style={thRightStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* B. Uses memoized paginationData instead of IIFE */}
                    {paginationData.paginatedItems.map((att, idx) => {
                      const globalIdx = paginationData.startIndex + idx;
                      // A. O(1) lookup from memoized map instead of O(n) filter
                      const sameExamList = examAttemptsMap.get(String(att.exam_id)) || [att];
                      const attemptIndex = sameExamList.findIndex((a) => a.attempt_id === att.attempt_id);
                      const attemptNum = sameExamList.length - attemptIndex;

                      return (
                        <tr
                          key={att.attempt_id}
                          style={tbodyRowStyle}
                        >
                          <td style={tdIndexStyle}>{globalIdx + 1}</td>
                          <td style={tdNameStyle}>
                            <div style={tdNameInnerStyle}>
                              <span>{att.exam_name}</span>
                              {sameExamList.length > 1 && (
                                <span style={attemptBadgeStyle}>
                                  Attempt #{attemptNum}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={tdCellStyle}>
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
                              {formatEnum(att.mode)}
                            </span>
                          </td>
                          <td style={tdMutedStyle}>
                            {new Date(att.started_at).toLocaleDateString()}
                          </td>
                          <td style={tdScoreStyle}>
                            <span style={{ color: Number(att.total_score) >= 92 ? '#3A8B53' : '#E31B23' }}>
                              {att.total_score}
                            </span>{' '}
                            <span style={tdScoreMaxStyle}>/ {att.max_possible_score} Marks</span>
                          </td>
                          <td style={tdMutedStyle}>
                            {att.total_questions} Questions
                          </td>
                          <td style={tdActionStyle}>
                            <button
                              onClick={() => handleViewSingleExam(att.attempt_id)}
                              style={viewReportBtnStyle}
                            >
                              View Exam Report →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls — B. uses shared memoized paginationData */}
              {attemptsHistory.length > historyPageSize && (
                <div style={paginationWrapperStyle}>
                  <div style={paginationInfoStyle}>
                    Showing <strong style={{ color: 'var(--text-primary)' }}>{paginationData.startItem} - {paginationData.endItem}</strong> of <strong style={{ color: 'var(--text-primary)' }}>{attemptsHistory.length}</strong> attempts
                  </div>

                  <div style={paginationControlsStyle}>
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

                    {Array.from({ length: paginationData.totalPages }, (_, i) => i + 1).map((pageNum) => (
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
                      disabled={historyPage >= paginationData.totalPages}
                      onClick={() => setHistoryPage((p) => Math.min(paginationData.totalPages, p + 1))}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 0,
                        border: '1px solid var(--border-default)',
                        backgroundColor: historyPage >= paginationData.totalPages ? 'transparent' : 'var(--bg-subtle)',
                        color: historyPage >= paginationData.totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: historyPage >= paginationData.totalPages ? 'not-allowed' : 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        opacity: historyPage >= paginationData.totalPages ? 0.5 : 1,
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Long-Polling Evaluation State (Zero Deployment Timeout Guarantee) */}
          {isEvaluating && (
            <div style={evaluatingContainerStyle}>
              <div style={evaluatingIconsStyle}>
                <Cpu size={28} className="animate-spin" />
                <Sparkles size={24} color="#8b5cf6" />
              </div>

              <h2 style={evaluatingTitleStyle}>
                Psychometric Evaluation Engine Active
              </h2>

              <p style={evaluatingMsgStyle}>
                {evalMessage}
              </p>

              {/* Progress Bar */}
              <div style={progressBarOuterStyle}>
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

              <span style={evalLabelStyle}>
                Polling live diagnostics ({evalProgress}% Complete)
              </span>
            </div>
          )}

          {/* Loading Skeleton */}
          {useMinimumLoadingTime(isLoading && !isEvaluating, 400) && (
            <div style={skeletonWrapperStyle}>
              <PerformanceAnalyticsSkeleton />
            </div>
          )}

          {/* Error / Processing Banner */}
          {error && !isEvaluating && (
            <div style={errorBannerStyle}>
              <div style={errorBannerContentStyle}>
                <AlertCircle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
                <div style={errorBannerTextStyle}>
                  <strong style={errorBannerLabelStyle}>Evaluation Notice: </strong>
                  <span>{error}</span>
                </div>
              </div>

              {selectedAttemptId && selectedAttemptId !== 'CUMULATIVE_ALL' && (
                <button
                  onClick={handleRetryEvaluation}
                  disabled={isRetrying}
                  style={{
                    ...retryBtnStyle,
                    cursor: isRetrying ? 'not-allowed' : 'pointer',
                    opacity: isRetrying ? 0.7 : 1,
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
            />
          ) : (
            !isLoading && !isEvaluating && (
              <div style={noReportContainerStyle}>
                <div style={noReportIconStyle}>
                  ⚠️
                </div>

                <h2 style={noReportTitleStyle}>
                  Unable to Generate Report
                </h2>

                <p style={noReportDescStyle}>
                  No evaluated telemetry or psychometric data is available for this exam attempt yet. Complete and submit a practice exam or mock test to generate your 12-matrix diagnostic report.
                </p>

                <div style={noReportActionsStyle}>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    style={refreshBtnStyle}
                  >
                    ↻ Refresh Analysis
                  </button>

                  <button
                    type="button"
                    onClick={() => (window.location.href = '/practice')}
                    style={practiceExamBtnStyle}
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
