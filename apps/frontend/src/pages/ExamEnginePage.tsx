import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamSectionSidebar, Section, Question } from '../components/exam/ExamSectionSidebar';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { ExamQuestionPalette } from '../components/exam/ExamQuestionPalette';
import { ExamFooterBar } from '../components/exam/ExamFooterBar';
import { ExamSubmitModal } from '../components/exam/ExamSubmitModal';
import { FileText, Layers, Grid, Loader2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import {
  startExamAttempt,
  getExamAttemptStatus,
  getQuestionByNumber,
  getAllAttemptQuestionsBulk,
  prefetchQuestion,
  saveQuestionResponse,
  saveQuestionResponsesBatch,
  getResponseBatchStatus,
  revealQuestionAnswer,
  sendExamHeartbeat,
  submitExamAttempt,
} from '../services/examService';

import {
  AttemptMode,
  QuestionNavResponse,
  QuestionOut,
  QuestionPaletteItem,
  RevealAnswerResponse,
  ResponseSummary,
  BatchSaveItem,
} from '../types/exam';

export function ExamEnginePage() {
  const { examId, attemptId: paramAttemptId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ─── Session State ───────────────────────────────────────────────────────────
  const [attemptId, setAttemptId] = useState<string | null>(paramAttemptId || null);
  const [attemptMode, setAttemptMode] = useState<AttemptMode>('EXAM');
  const [currentQIndex, setCurrentQIndex] = useState(0); // 0-indexed for UI
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [timeLeft, setTimeLeft] = useState(7200);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'marked' | 'unanswered'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  // Preloaded All Questions for Zero-Lag Client-Side Caching & Language Switching
  const [allQuestions, setAllQuestions] = useState<QuestionOut[]>([]);

  // Active question & responses
  const [activeQuestion, setActiveQuestion] = useState<QuestionNavResponse['question'] | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string | null>(null);
  const [isMarkedForReview, setIsMarkedForReview] = useState(false);
  const [revealResults, setRevealResults] = useState<Record<string, RevealAnswerResponse>>({});
  const [palette, setPalette] = useState<QuestionPaletteItem[]>([]);
  const [responseSummary, setResponseSummary] = useState<ResponseSummary>({
    answered_count: 0,
    marked_for_review_count: 0,
    unattempted_count: 100,
    total: 100,
  });

  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});

  // Mobile Responsiveness State
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [mobileTab, setMobileTab] = useState<'question' | 'sections' | 'palette'>('question');

  // Question Time Telemetry tracking
  const questionStartTimeRef = useRef<number>(Date.now());

  // ─── Asynchronous Batch Queue & Smart Dirty-Check Manager ─────────────────
  const pendingBatchQueueRef = useRef<Map<string, BatchSaveItem>>(new Map());
  const lastSyncedSnapshotRef = useRef<Map<string, { selected_option_id: string | null; is_marked_for_review: boolean; time_spent_seconds: number }>>(new Map());
  const isSyncingBatchRef = useRef<boolean>(false);

  // Queue a modified response if it passes dirty-check verification
  const queueResponseUpdate = (
    questionId: string,
    optId: string | null,
    markedForRev: boolean
  ) => {
    if (!questionId) return;
    const timeSpent = (Date.now() - questionStartTimeRef.current) / 1000.0;
    const last = lastSyncedSnapshotRef.current.get(questionId);

    // Dirty-check verification: verify if genuinely modified to avoid false flags
    const isOptionModified = !last ? optId !== null : last.selected_option_id !== optId;
    const isReviewModified = !last ? markedForRev : last.is_marked_for_review !== markedForRev;
    const isTimeModified = !last ? timeSpent > 1.0 : Math.abs((last.time_spent_seconds || 0) - timeSpent) >= 2.0;

    if (isOptionModified || isReviewModified || isTimeModified) {
      const item: BatchSaveItem = {
        question_id: questionId,
        selected_option_id: optId,
        is_marked_for_review: markedForRev,
        time_spent_seconds: timeSpent,
        client_timestamp: new Date().toISOString(),
      };
      console.info(`%c[ExamEngine:DIRTY_DETECTED] Queued modified response for Question ${questionId}`, 'color: #ec4899; font-weight: bold;', {
        item,
        reason: { isOptionModified, isReviewModified, isTimeModified }
      });
      pendingBatchQueueRef.current.set(questionId, item);
    } else {
      console.debug(`[ExamEngine:CLEAN] Question ${questionId} is clean/unmodified against snapshot, queueing omitted.`);
    }
  };

  // Flush pending batches asynchronously in the background
  const flushPendingBatches = async () => {
    if (!attemptId || pendingBatchQueueRef.current.size === 0 || isSyncingBatchRef.current) {
      return;
    }

    isSyncingBatchRef.current = true;
    const itemsToSend = Array.from(pendingBatchQueueRef.current.values());
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.info(`%c[ExamEngine:FLUSH_START] Dispatching batch '${batchId}' (${itemsToSend.length} items) to backend...`, 'color: #06b6d4; font-weight: bold;', itemsToSend);

    try {
      const ack = await saveQuestionResponsesBatch(attemptId, {
        batch_id: batchId,
        responses: itemsToSend,
      });

      if (ack.status === 'ACCEPTED' || ack.status === 'PROCESSED') {
        console.info(`%c[ExamEngine:FLUSH_SUCCESS] Batch '${batchId}' acknowledged as ${ack.status}`, 'color: #10b981; font-weight: bold;', ack);
        // Record successfully synced snapshot for dirty-checking
        for (const item of itemsToSend) {
          lastSyncedSnapshotRef.current.set(item.question_id, {
            selected_option_id: item.selected_option_id ?? null,
            is_marked_for_review: Boolean(item.is_marked_for_review),
            time_spent_seconds: item.time_spent_seconds ?? 0,
          });
          // Remove confirmed item from pending queue
          pendingBatchQueueRef.current.delete(item.question_id);
        }

        if (ack.response_summary) {
          setResponseSummary(ack.response_summary);
        }
      }
    } catch (err) {
      console.warn(`%c[ExamEngine:FLUSH_ERROR] Batch '${batchId}' failed to sync, retaining ${itemsToSend.length} items in retry buffer:`, 'color: #ef4444; font-weight: bold;', err);
      // Items remain in pendingBatchQueueRef for automatic retry on next flush
    } finally {
      isSyncingBatchRef.current = false;
    }
  };

  // Periodic background flush every 2.5 seconds
  useEffect(() => {
    if (!attemptId) return;
    const interval = setInterval(() => {
      flushPendingBatches();
    }, 2500);
    return () => clearInterval(interval);
  }, [attemptId]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── 1. Session Initialization / Resume ─────────────────────────────────────
  useEffect(() => {
    async function initSession() {
      setIsLoadingSession(true);
      try {
        if (paramAttemptId) {
          // Resume existing session
          const sessionStatus = await getExamAttemptStatus(paramAttemptId);
          setAttemptId(sessionStatus.attempt_id);
          setAttemptMode(sessionStatus.mode);
          setTimeLeft(sessionStatus.remaining_seconds);
          setTotalQuestions(sessionStatus.total_questions);
          setPalette(sessionStatus.palette);
          setResponseSummary(sessionStatus.response_summary);
          setCurrentQIndex(sessionStatus.current_question_index);

          // 1-Call Bulk Preload for Zero-Lag Question Switching & Language Toggle
          try {
            const bulkData = await getAllAttemptQuestionsBulk(sessionStatus.attempt_id);
            if (bulkData.questions && bulkData.questions.length > 0) {
              setAllQuestions(bulkData.questions);
              const curQ = bulkData.questions[sessionStatus.current_question_index] || bulkData.questions[0];
              setActiveQuestion(curQ);
            } else {
              await loadQuestion(sessionStatus.attempt_id, sessionStatus.current_question_index + 1);
            }
          } catch (bulkErr) {
            console.warn('Bulk preload fallback to single fetch:', bulkErr);
            await loadQuestion(sessionStatus.attempt_id, sessionStatus.current_question_index + 1);
          }
        } else if (examId) {
          // Start new attempt session
          const startRes = await startExamAttempt({ exam_id: examId, mode: 'EXAM' });
          setAttemptId(startRes.attempt_id);
          setAttemptMode(startRes.mode);
          setTimeLeft(startRes.max_duration_seconds);
          setTotalQuestions(startRes.total_questions);
          setPalette(startRes.palette);
          setActiveQuestion(startRes.first_question.question);
          setSelectedOptionId(startRes.first_question.response_state.selected_option_id as string | null);
          setIsMarkedForReview(startRes.first_question.response_state.is_marked_for_review);

          // Preload rest in background
          try {
            const bulkData = await getAllAttemptQuestionsBulk(startRes.attempt_id);
            if (bulkData.questions && bulkData.questions.length > 0) {
              setAllQuestions(bulkData.questions);
            }
          } catch (bulkErr) {
            console.warn('Bulk preload warning:', bulkErr);
          }
        } else {
          // Fallback demo questions if no examId/attemptId provided in route
          loadFallbackDemoData();
        }
      } catch (err) {
        console.warn('Backend exam session init error, using fallback demo data:', err);
        loadFallbackDemoData();
      } finally {
        setIsLoadingSession(false);
      }
    }

    initSession();
  }, [examId, paramAttemptId]);

  // ─── Helper: Fetch Specific Question ───────────────────────────────────────
  const loadQuestion = async (attId: string, qNum: number) => {
    if (allQuestions.length >= qNum && allQuestions[qNum - 1]) {
      // Instant Client-Side Zero-Lag Question Flipping
      questionStartTimeRef.current = Date.now();
      const q = allQuestions[qNum - 1];
      setActiveQuestion(q);
      const saved = lastSyncedSnapshotRef.current.get(q.question_id) || pendingBatchQueueRef.current.get(q.question_id);
      if (saved) {
        setSelectedOptionId(saved.selected_option_id || null);
        setIsMarkedForReview(Boolean(saved.is_marked_for_review));
        const matched = q.options?.find((o: any) => o.option_id === saved.selected_option_id);
        setSelectedOptionLabel(matched ? matched.option_label : null);
      } else {
        setSelectedOptionId(null);
        setSelectedOptionLabel(null);
        setIsMarkedForReview(false);
      }
      return;
    }

    setIsLoadingQuestion(true);
    questionStartTimeRef.current = Date.now();
    try {
      const langParam = language === 'hi' ? 'HINDI' : 'ENGLISH';
      const qNav = await getQuestionByNumber(attId, qNum, langParam);
      setActiveQuestion(qNav.question);
      setSelectedOptionId(qNav.response_state.selected_option_id as string | null);
      setIsMarkedForReview(qNav.response_state.is_marked_for_review);

      // Find matching label
      const matchedOpt = qNav.question.options.find((o) => o.option_id === qNav.response_state.selected_option_id);
      setSelectedOptionLabel(matchedOpt ? matchedOpt.option_label : null);

      // Background prefetching for instant zero-lag next question switching
      if (qNum + 1 <= totalQuestions) {
        prefetchQuestion(attId, qNum + 1, langParam);
      }
      if (qNum + 2 <= totalQuestions) {
        prefetchQuestion(attId, qNum + 2, langParam);
      }
    } catch (err) {
      console.error('Failed to fetch question by number:', err);
    } finally {
      setIsLoadingQuestion(false);
    }
  };


  // ─── Live Countdown & Heartbeat Sync ─────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!attemptId) return;

    // Send Heartbeat every 15 seconds
    const heartbeatInterval = setInterval(async () => {
      try {
        const hbRes = await sendExamHeartbeat(attemptId, {
          remaining_time_seconds: timeLeft,
          active_question_id: activeQuestion?.question_id || null,
        });

        if (hbRes.auto_submitted) {
          alert('Time has expired! Your exam has been automatically submitted.');
          navigate(`/analytics?attemptId=${attemptId}`);
        }
      } catch (err) {
        console.warn('Heartbeat sync warning:', err);
      }
    }, 15000);

    return () => clearInterval(heartbeatInterval);
  }, [attemptId, timeLeft, activeQuestion]);

  // ─── Zero-Lag Action Handlers with Asynchronous Batching ──────────────────────
  const handleSelectOption = (optionId: string, optionLabel: string) => {
    setSelectedOptionId(optionId);
    setSelectedOptionLabel(optionLabel);

    const newStatus = isMarkedForReview ? 'ANSWERED_AND_MARKED' : 'ANSWERED';
    updatePaletteItemStatus(currentQIndex, newStatus);

    if (activeQuestion) {
      queueResponseUpdate(activeQuestion.question_id, optionId, isMarkedForReview);
    }
  };

  const handleClearResponse = () => {
    setSelectedOptionId(null);
    setSelectedOptionLabel(null);

    const newStatus = isMarkedForReview ? 'MARKED_FOR_REVIEW' : 'VISITED';
    updatePaletteItemStatus(currentQIndex, newStatus);

    if (activeQuestion) {
      queueResponseUpdate(activeQuestion.question_id, null, isMarkedForReview);
    }
  };

  const handleToggleMarkReview = () => {
    const nextMarked = !isMarkedForReview;
    setIsMarkedForReview(nextMarked);

    const newStatus = selectedOptionId
      ? nextMarked
        ? 'ANSWERED_AND_MARKED'
        : 'ANSWERED'
      : nextMarked
        ? 'MARKED_FOR_REVIEW'
        : 'VISITED';
    updatePaletteItemStatus(currentQIndex, newStatus as any);

    if (activeQuestion) {
      queueResponseUpdate(activeQuestion.question_id, selectedOptionId, nextMarked);
    }
  };

  const handleRevealAnswer = async () => {
    if (!attemptId || !activeQuestion) return;
    setIsRevealing(true);
    try {
      const revRes = await revealQuestionAnswer(attemptId, activeQuestion.question_id);
      setRevealResults((prev) => ({ ...prev, [activeQuestion.question_id]: revRes }));
    } catch (err: any) {
      alert(err.message || 'Failed to reveal answer.');
    } finally {
      setIsRevealing(false);
    }
  };

  const updatePaletteItemStatus = (idx: number, status: QuestionPaletteItem['question_status']) => {
    setPalette((prev) => {
      const copy = [...prev];
      if (copy[idx]) {
        copy[idx] = { ...copy[idx], question_status: status };
      }
      return copy;
    });
  };

  const saveCurrentResponse = () => {
    if (activeQuestion) {
      queueResponseUpdate(activeQuestion.question_id, selectedOptionId, isMarkedForReview);
      // Trigger non-blocking background flush
      flushPendingBatches();
    }
  };

  const handleNext = async () => {
    saveCurrentResponse();
    if (currentQIndex < totalQuestions - 1) {
      const nextIdx = currentQIndex + 1;
      setCurrentQIndex(nextIdx);
      if (attemptId) {
        await loadQuestion(attemptId, nextIdx + 1);
      }
      if (isMobile) setMobileTab('question');
    }
  };

  const handlePrev = async () => {
    saveCurrentResponse();
    if (currentQIndex > 0) {
      const prevIdx = currentQIndex - 1;
      setCurrentQIndex(prevIdx);
      if (attemptId) {
        await loadQuestion(attemptId, prevIdx + 1);
      }
      if (isMobile) setMobileTab('question');
    }
  };

  const handleSelectQuestionFromPalette = async (idx: number) => {
    saveCurrentResponse();
    setCurrentQIndex(idx);
    if (attemptId) {
      await loadQuestion(attemptId, idx + 1);
    }
    if (isMobile) setMobileTab('question');
  };

  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (attemptId) {
        // Zero-Data-Loss Guarantee: Flush all pending batches before final submission
        saveCurrentResponse();
        await flushPendingBatches();

        await submitExamAttempt(attemptId, { submission_reason: 'USER_CLICKED_SUBMIT' });
        navigate(`/analytics?attemptId=${attemptId}`);
      } else {
        navigate('/analytics');
      }
    } catch (err) {
      console.error('Failed to submit exam attempt:', err);
      navigate(attemptId ? `/analytics?attemptId=${attemptId}` : '/analytics');
    } finally {
      setIsSubmitting(false);
      setShowSubmitModal(false);
    }
  };

  // ─── Fallback Demo Questions Setup ──────────────────────────────────────────
  function loadFallbackDemoData() {
    setTotalQuestions(5);
    setResponseSummary({ answered_count: 0, marked_for_review_count: 0, unattempted_count: 5, total: 5 });
    setActiveQuestion({
      question_id: 'demo-1',
      question_number: 1,
      text: 'Which of the following Fundamental Duties was added to the Constitution of India by the 42nd Constitutional Amendment Act, 1976?',
      options: [
        { option_id: 'opt-a', option_label: 'A', text: 'To abide by the Constitution and respect its ideals and institutions' },
        { option_id: 'opt-b', option_label: 'B', text: 'To develop scientific temper, humanism and the spirit of inquiry and reform' },
        { option_id: 'opt-c', option_label: 'C', text: "To provide opportunities for education to one's child between six and fourteen years" },
        { option_id: 'opt-d', option_label: 'D', text: 'To cast vote in general elections without fear or favor' },
      ],
      section_code: 'Indian Polity',
      difficulty: 'MEDIUM',
      marks: 2.0,
      negative_marks: 0.66,
      expected_time_seconds: 60,
    });
  }

  const sections: Section[] = [
    { id: 'polity', label: 'Indian Polity', total: 10 },
    { id: 'economy', label: 'Indian Economy', total: 8 },
    { id: 'history', label: 'History & Culture', total: 7 },
    { id: 'geography', label: 'Geography & Environment', total: 8 },
  ];

  if (isLoadingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Loader2 size={28} className="animate-spin" color="#2563eb" />
        <span style={{ fontSize: 16, fontWeight: 700 }}>Initializing RankEdge Exam Session...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        overflowX: 'hidden',
      }}
    >
      {/* Top Header */}
      <ExamHeader
        examTitle="RankEdge PYQ Engine"
        paperSubtitle="UPSC CSE Prelims 2023 • GS Paper I"
        timeLeft={timeLeft}
        language={language}
        isSubmitting={isSubmitting}
        onLanguageChange={setLanguage}
        onSubmitClick={() => setShowSubmitModal(true)}
      />

      {/* Mobile Tab Switcher Bar (< 1024px) */}
      {isMobile && (
        <div
          style={{
            marginTop: 64,
            height: 44,
            backgroundColor: isDark ? '#0f1e3c' : '#ffffff',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            padding: '0 8px',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 90,
          }}
        >
          {[
            { id: 'question', label: 'Question', icon: FileText },
            { id: 'sections', label: 'Sections', icon: Layers },
            { id: 'palette', label: 'Palette', icon: Grid },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: isActive ? '#2563eb' : 'transparent',
                  color: isActive ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748b',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <TabIcon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Viewport Body */}
      <div
        style={{
          marginTop: isMobile ? 108 : 64,
          marginBottom: 70,
          display: 'flex',
          flex: 1,
          height: isMobile ? 'calc(100vh - 178px)' : 'calc(100vh - 134px)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Left: Section Sidebar */}
        {(!isMobile || mobileTab === 'sections') && (
          <div style={{ width: isMobile ? '100%' : 240, height: '100%' }}>
            <ExamSectionSidebar
              sections={sections}
              activeSectionId="all"
              palette={palette}
              totalQuestions={totalQuestions}
              currentQIndex={currentQIndex}
              responseSummary={responseSummary}
              onSelectQuestion={handleSelectQuestionFromPalette}
            />
          </div>
        )}

        {/* Center: Question Card */}
        {(!isMobile || mobileTab === 'question') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {isLoadingQuestion ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Loader2 size={24} className="animate-spin" color="#2563eb" />
                <span>Loading question #{currentQIndex + 1}...</span>
              </div>
            ) : activeQuestion ? (
              <ExamQuestionCard
                question={activeQuestion}
                questionIndex={currentQIndex}
                totalQuestions={totalQuestions}
                selectedOptionId={selectedOptionId}
                selectedOptionLabel={selectedOptionLabel}
                isBookmarked={!!bookmarkedQs[currentQIndex]}
                language={language}
                mode={attemptMode}
                revealResult={activeQuestion ? revealResults[activeQuestion.question_id] : null}
                isRevealing={isRevealing}
                onSelectOption={handleSelectOption}
                onToggleBookmark={() => setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }))}
                onRevealAnswer={handleRevealAnswer}
              />
            ) : null}
          </div>
        )}

        {/* Right: Question Palette */}
        {(!isMobile || mobileTab === 'palette') && (
          <div style={{ width: isMobile ? '100%' : 300, height: '100%' }}>
            <ExamQuestionPalette
              palette={palette.length > 0 ? palette : undefined}
              currentQIndex={currentQIndex}
              paletteFilter={paletteFilter}
              onSelectQuestion={handleSelectQuestionFromPalette}
              onFilterChange={setPaletteFilter}
            />
          </div>
        )}
      </div>

      {/* Sticky Bottom Control Bar */}
      <ExamFooterBar
        isAnswered={selectedOptionId !== null}
        isMarkedForReview={isMarkedForReview}
        isFirstQuestion={currentQIndex === 0}
        onClearResponse={handleClearResponse}
        onToggleMarkReview={handleToggleMarkReview}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {/* Submit Confirmation Modal */}
      <ExamSubmitModal
        isOpen={showSubmitModal}
        answeredCount={responseSummary.answered_count}
        markedCount={responseSummary.marked_for_review_count}
        unattemptedCount={responseSummary.unattempted_count}
        isSubmitting={isSubmitting}
        onResume={() => !isSubmitting && setShowSubmitModal(false)}
        onConfirmSubmit={handleConfirmSubmit}
      />

      {/* Fullscreen Submitting & Evaluating Overlay */}
      {isSubmitting && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            gap: 16,
          }}
        >
          <Loader2 size={44} className="animate-spin" color="#3b82f6" />
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display, sans-serif)' }}>
            Submitting & Evaluating Test...
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.75)', maxWidth: 420, textAlign: 'center', lineHeight: 1.5 }}>
            Please wait while your responses are securely saved and your psychometric performance analysis is computed.
          </div>
        </div>
      )}
    </div>
  );
}

