import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ExamHeader } from '../components/exam/ExamHeader';
import { Section, Question } from '../components/exam/ExamSectionSidebar';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { ExamQuestionPalette } from '../components/exam/ExamQuestionPalette';
import { ExamFooterBar } from '../components/exam/ExamFooterBar';
import { ExamSubmitModal } from '../components/exam/ExamSubmitModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { FileText, Layers, Grid, Loader2, Trophy, CheckCircle, XCircle, ArrowRight, UserPlus, Sparkles, RefreshCw } from 'lucide-react';
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
  listExams,
  ExamItem,
} from '../services/examService';
import { saveGuestAttempt } from '../utils/guestStorage';
import { AuthModal, AuthMode } from '../components/auth/AuthModal';

import {
  AttemptMode,
  QuestionNavResponse,
  QuestionOut,
  QuestionPaletteItem,
  RevealAnswerResponse,
  ResponseSummary,
  BatchSaveItem,
} from '../types/exam';

export function ExamEnginePage({ isGuest = false }: { isGuest?: boolean }) {
  const { examId, attemptId: paramAttemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isDark = false;

  const isGuestMode = isGuest || location.pathname === '/guest-exam';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Guest Scorecard Modal State
  const [showGuestScoreModal, setShowGuestScoreModal] = useState(false);
  const [guestScoreData, setGuestScoreData] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [isPYQ, setIsPYQ] = useState<boolean>(false);

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
  const { isMobile, isTabletOrBelow } = useBreakpoint();
  const [mobileTab, setMobileTab] = useState<'question' | 'palette'>('question');

  // Question Time Telemetry tracking & Multi-Visit Dwell Accumulator
  const questionStartTimeRef = useRef<number>(Date.now());
  const accumulatedTimePerQuestionRef = useRef<Map<string, number>>(new Map());

  const getActiveQuestionTotalTime = (qId?: string) => {
    const targetId = qId || activeQuestion?.question_id;
    if (!targetId) return 0;
    const prevAcc = accumulatedTimePerQuestionRef.current.get(targetId) || 0;
    const isActive = !qId || qId === activeQuestion?.question_id;
    const currentVisit = isActive ? Math.max(0, (Date.now() - questionStartTimeRef.current) / 1000.0) : 0;
    return Math.max(0, prevAcc + currentVisit);
  };

  const saveQuestionVisitTime = (qId?: string) => {
    const targetId = qId || activeQuestion?.question_id;
    if (!targetId) return;
    const elapsed = Math.max(0, (Date.now() - questionStartTimeRef.current) / 1000.0);
    const prevAcc = accumulatedTimePerQuestionRef.current.get(targetId) || 0;
    const newAcc = prevAcc + elapsed;
    accumulatedTimePerQuestionRef.current.set(targetId, newAcc);
    questionStartTimeRef.current = Date.now();
  };

  // ─── Asynchronous Batch Queue & Smart Dirty-Check Manager ─────────────────
  const pendingBatchQueueRef = useRef<Map<string, BatchSaveItem>>(new Map());
  const lastSyncedSnapshotRef = useRef<Map<string, { selected_option_id: string | null; is_marked_for_review: boolean; time_spent_seconds: number }>>(new Map());
  const optionSwitchesCountRef = useRef<Map<string, number>>(new Map());
  const isSyncingBatchRef = useRef<boolean>(false);

  // Queue a modified response if it passes dirty-check verification
  const queueResponseUpdate = (
    questionId: string,
    optId: string | null,
    markedForRev: boolean,
    forcedTimeSpent?: number
  ) => {
    if (!questionId) return;
    const timeSpent = forcedTimeSpent !== undefined ? forcedTimeSpent : getActiveQuestionTotalTime(questionId);
    const last = lastSyncedSnapshotRef.current.get(questionId);

    // Dirty-check verification: verify if genuinely modified to avoid false flags
    const isOptionModified = !last ? optId !== null : last.selected_option_id !== optId;
    const isReviewModified = !last ? markedForRev : last.is_marked_for_review !== markedForRev;
    const isTimeModified = !last ? timeSpent > 0.2 : Math.abs((last.time_spent_seconds || 0) - timeSpent) >= 1.0;

    const switchCount = optionSwitchesCountRef.current.get(questionId) || 0;

    if (isOptionModified || isReviewModified || isTimeModified) {
      const item: BatchSaveItem = {
        question_id: questionId,
        selected_option_id: optId,
        is_marked_for_review: markedForRev,
        time_spent_seconds: Math.round(timeSpent * 10) / 10,
        is_switched: switchCount > 0,
        option_switch_count: switchCount,
        client_timestamp: new Date().toISOString(),
      };
      pendingBatchQueueRef.current.set(questionId, item);
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

    try {
      const ack = await saveQuestionResponsesBatch(attemptId, {
        batch_id: batchId,
        responses: itemsToSend,
      });

      if (ack.status === 'ACCEPTED' || ack.status === 'PROCESSED') {
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
      console.warn(`[ExamEngine:FLUSH_ERROR] Batch '${batchId}' failed to sync, retaining ${itemsToSend.length} items in retry buffer:`, err);
      // Items remain in pendingBatchQueueRef for automatic retry on next flush
    } finally {
      isSyncingBatchRef.current = false;
    }
  };

  // Active Real-Time 3s Telemetry & Background Sync Interval
  useEffect(() => {
    if (!attemptId) return;
    const interval = setInterval(() => {
      if (activeQuestion) {
        const currentTotalTime = getActiveQuestionTotalTime(activeQuestion.question_id);
        queueResponseUpdate(
          activeQuestion.question_id,
          selectedOptionId,
          isMarkedForReview,
          currentTotalTime
        );
      }
      flushPendingBatches();
    }, 3000);
    return () => clearInterval(interval);
  }, [attemptId, activeQuestion, selectedOptionId, isMarkedForReview]);



  // ─── 1. Session Initialization / Resume ─────────────────────────────────────
  useEffect(() => {
    async function initSession() {
      setIsLoadingSession(true);
      try {
        if (isGuestMode) {
          await loadGuestSessionQuestions();
          return;
        }

        const typeParam = searchParams.get('type');
        const examParam = searchParams.get('exam');
        let isPyqTest = typeParam === 'PYQ';

        if (!typeParam) {
          if (
            (examId && examId.toLowerCase().includes('pyq')) ||
            (paramAttemptId && paramAttemptId.toLowerCase().includes('pyq')) ||
            (examParam && examParam.toLowerCase().includes('pyq'))
          ) {
            isPyqTest = true;
          }
        }

        try {
          const liveExams: ExamItem[] = await listExams();
          const targetId = examId || paramAttemptId;
          const match = liveExams.find(
            (e: ExamItem) => e.id === targetId || e.code === targetId || e.name === targetId
          );
          if (match) {
            if (
              match.exam_type === 'PYQ' ||
              match.code?.toLowerCase().includes('pyq') ||
              match.name?.toLowerCase().includes('pyq')
            ) {
              isPyqTest = true;
            } else if (
              match.exam_type === 'STATIC_MOCK' ||
              match.exam_type === 'MOCK' ||
              match.code?.toLowerCase().includes('mock') ||
              match.name?.toLowerCase().includes('mock')
            ) {
              isPyqTest = false;
            }
          }
        } catch (e) {
          console.warn('Exam type lookup warning:', e);
        }

        setIsPYQ(isPyqTest);

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
            const bulkData = await getAllAttemptQuestionsBulk(
              sessionStatus.attempt_id,
              'ENGLISH',
              sessionStatus.questions_presigned_url
            );
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
            const bulkData = await getAllAttemptQuestionsBulk(
              startRes.attempt_id,
              'ENGLISH',
              startRes.questions_presigned_url
            );
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
  }, [examId, paramAttemptId, isGuestMode]);

  const loadGuestSessionQuestions = async () => {
    const gExam = searchParams.get('exam') || 'UPSC Prelims (GS Paper 1)';
    const gYear = searchParams.get('year') || '2023';
    const gTopic = searchParams.get('topic') || 'Indian Polity & Governance';
    const gSubtopic = searchParams.get('subtopic') || 'Fundamental Rights';
    const gCount = parseInt(searchParams.get('count') || '10', 10);

    setTotalQuestions(gCount);
    setTimeLeft(gCount * 120);
    setAttemptMode('PRACTICE');

    const apiParams = new URLSearchParams({
      limit: gCount.toString(),
    });

    if (gTopic && gTopic !== 'All Topics') {
      apiParams.append('topic_name', gTopic);
    }
    if (gSubtopic && gSubtopic !== 'All Subtopics') {
      apiParams.append('subtopic_name', gSubtopic);
    }
    if (gYear && gYear !== 'All Years (2018 - 2024)' && !isNaN(Number(gYear))) {
      apiParams.append('exam_year', gYear);
    }
    if (gExam && gExam.toLowerCase().includes('upsc')) {
      apiParams.append('exam_name', 'upsc');
    }

    try {
      const res = await fetch(`/api/v1/questions?${apiParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const itemsToUse = data.items.length > gCount ? data.items.slice(0, gCount) : data.items;
          const questionsList: QuestionOut[] = itemsToUse.map((q: any, idx: number) => ({
            question_id: q.question_id || `q-guest-${idx + 1}`,
            question_number: idx + 1,
            text: q.question_text || `Question #${idx + 1}`,
            options: (q.options || []).map((o: any) => ({
              option_id: o.option_id || `opt-${idx}-${o.option_label}`,
              option_label: o.option_label,
              text: o.option_text || o.text || `Option ${o.option_label}`,
              is_correct: Boolean(o.is_correct),
            })),
            section_code: q.topic_name || q.subject_name || gTopic || 'General Studies',
            difficulty: q.difficulty || 'MEDIUM',
            marks: q.marks || 2.0,
            negative_marks: q.negative_marks || 0.66,
            expected_time_seconds: q.expected_time_seconds || 60,
          }));

          setAllQuestions(questionsList);
          setTotalQuestions(questionsList.length);
          setActiveQuestion(questionsList[0]);

          const initialPalette: QuestionPaletteItem[] = questionsList.map((q, i) => ({
            question_number: i + 1,
            question_id: q.question_id,
            question_status: i === 0 ? 'VISITED' : ('UNVISITED' as any),
          }));
          setPalette(initialPalette);
          setResponseSummary({
            answered_count: 0,
            marked_for_review_count: 0,
            unattempted_count: questionsList.length,
            total: questionsList.length,
          });
          return;
        }
      }
    } catch (err) {
      console.warn('API questions fetch warning for guest mode:', err);
    }

    // Fallback demo questions if database has no matching items for the criteria
    loadGuestFallbackData(gTopic, gSubtopic, gCount);
  };

  function loadGuestFallbackData(topicName: string, subtopicName: string, count: number) {
    const sampleQuestions: QuestionOut[] = Array.from({ length: count }, (_, idx) => {
      const qNum = idx + 1;
      return {
        question_id: `guest-q-${qNum}`,
        question_number: qNum,
        text: `[${topicName} - ${subtopicName}] Question #${qNum}: Which of the following statements regarding ${subtopicName !== 'All Subtopics' ? subtopicName : topicName} under the Indian Constitution / Syllabus is correct?`,
        options: [
          { option_id: `g-opt-${qNum}-A`, option_label: 'A', text: `Statement I: It is guaranteed under Part III of the Constitution and enforceable by law.`, is_correct: true },
          { option_id: `g-opt-${qNum}-B`, option_label: 'B', text: `Statement II: It requires explicit legislative enactment for enforcement in all scenarios.`, is_correct: false },
          { option_id: `g-opt-${qNum}-C`, option_label: 'C', text: `Both Statement I and Statement II are incorrect.`, is_correct: false },
          { option_id: `g-opt-${qNum}-D`, option_label: 'D', text: `Neither Statement I nor Statement II applies to this subtopic.`, is_correct: false },
        ],
        section_code: topicName,
        difficulty: qNum % 2 === 0 ? 'HARD' : 'MEDIUM',
        marks: 2.0,
        negative_marks: 0.66,
        expected_time_seconds: 60,
      };
    });

    setAllQuestions(sampleQuestions);
    setTotalQuestions(sampleQuestions.length);
    setActiveQuestion(sampleQuestions[0]);

    const initialPalette: QuestionPaletteItem[] = sampleQuestions.map((q, i) => ({
      question_number: i + 1,
      question_id: q.question_id,
      question_status: i === 0 ? 'VISITED' : ('UNVISITED' as any),
    }));
    setPalette(initialPalette);
    setResponseSummary({
      answered_count: 0,
      marked_for_review_count: 0,
      unattempted_count: sampleQuestions.length,
      total: sampleQuestions.length,
    });
  }

  // ─── Helper: Fetch Specific Question ───────────────────────────────────────
  const loadQuestion = async (attId: string, qNum: number) => {
    // Record elapsed time on the outgoing question before switching
    if (activeQuestion) {
      saveQuestionVisitTime(activeQuestion.question_id);
    }

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
    if (activeQuestion) {
      const qId = activeQuestion.question_id;
      const prevOpt = selectedOptionId || lastSyncedSnapshotRef.current.get(qId)?.selected_option_id;
      if (prevOpt && prevOpt !== optionId) {
        const curCount = (optionSwitchesCountRef.current.get(qId) || 0) + 1;
        optionSwitchesCountRef.current.set(qId, curCount);
      }
    }

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
      const qId = activeQuestion?.question_id || `q-${idx + 1}`;
      copy[idx] = {
        question_number: idx + 1,
        question_id: copy[idx]?.question_id || qId,
        question_status: status,
      };
      return copy;
    });
  };

  const saveCurrentResponse = () => {
    if (activeQuestion) {
      const currentTotalTime = getActiveQuestionTotalTime(activeQuestion.question_id);
      queueResponseUpdate(activeQuestion.question_id, selectedOptionId, isMarkedForReview, currentTotalTime);
      // Trigger non-blocking background flush
      flushPendingBatches();
    }
  };

  const handleOpenSubmitModal = () => {
    saveCurrentResponse();
    setShowSubmitModal(true);
  };

  // Dynamic Live Response Summary computed from Palette State
  const liveAnsweredCount = palette.length > 0
    ? palette.filter((p) => p.question_status === 'ANSWERED' || p.question_status === 'ANSWERED_AND_MARKED').length
    : responseSummary.answered_count;

  const liveMarkedCount = palette.length > 0
    ? palette.filter((p) => p.question_status === 'MARKED_FOR_REVIEW' || p.question_status === 'ANSWERED_AND_MARKED').length
    : responseSummary.marked_for_review_count;

  const liveTotal = palette.length > 0 ? palette.length : (responseSummary.total || totalQuestions || 100);
  const liveUnattemptedCount = Math.max(0, liveTotal - liveAnsweredCount);

  const liveResponseSummary: ResponseSummary = {
    answered_count: liveAnsweredCount,
    marked_for_review_count: liveMarkedCount,
    unattempted_count: liveUnattemptedCount,
    total: liveTotal,
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

    if (isGuestMode || !attemptId) {
      let correctCount = 0;
      let wrongCount = 0;
      let unattemptedCount = 0;

      allQuestions.forEach((q) => {
        const saved = lastSyncedSnapshotRef.current.get(q.question_id) || pendingBatchQueueRef.current.get(q.question_id);
        const selId = saved?.selected_option_id;
        if (!selId) {
          unattemptedCount++;
        } else {
          const opt = q.options?.find((o: any) => o.option_id === selId);
          if (opt && opt.is_correct) {
            correctCount++;
          } else {
            wrongCount++;
          }
        }
      });

      const totalScore = allQuestions.length * 2.0;
      const score = Math.max(0, Number((correctCount * 2.0 - wrongCount * 0.66).toFixed(2)));
      const accuracy = Math.round((correctCount / (correctCount + wrongCount || 1)) * 100);

      const gExam = searchParams.get('exam') || 'UPSC Prelims';
      const gTopic = searchParams.get('topic') || 'Indian Polity & Governance';
      const gSubtopic = searchParams.get('subtopic') || 'Fundamental Rights';

      const responsesPayload = (allQuestions || []).map((q) => {
        const qId = q.question_id;
        const selOpt = selectedOptionId || lastSyncedSnapshotRef.current.get(qId)?.selected_option_id;
        const rev = revealResults[qId];
        return {
          question_id: qId,
          selected_option_id: selOpt || null,
          is_correct: Boolean(rev?.is_user_correct),
          time_taken_seconds: accumulatedTimePerQuestionRef.current.get(qId) || 60.0,
          expected_time_seconds: 60.0,
          is_switched: false,
        };
      });

      const guestPayload = {
        score,
        totalMarksPossible: totalScore,
        correctCount,
        incorrectCount: wrongCount,
        unattemptedCount,
        accuracy,
        totalQuestions: allQuestions.length,
        topicName: gTopic,
        subtopicName: gSubtopic,
        targetExam: gExam,
        targetYear: 'Target 2026',
        timeSpentSeconds: Math.max(0, 7200 - timeLeft),
        responses: responsesPayload,
      };

      setGuestScoreData(guestPayload);
      saveGuestAttempt(guestPayload);
      setShowGuestScoreModal(true);
      setIsSubmitting(false);
      setShowSubmitModal(false);
      return;
    }

    try {
      if (attemptId) {
        // Zero-Data-Loss Guarantee: Lock in active question dwell time and flush pending batches
        saveQuestionVisitTime();
        await flushPendingBatches();

        const allFinalResponses = (allQuestions || []).map((q) => {
          const qId = q.question_id;
          const isCurrentActive = activeQuestion?.question_id === qId;
          const saved = lastSyncedSnapshotRef.current.get(qId) || pendingBatchQueueRef.current.get(qId);
          const selOpt = isCurrentActive ? selectedOptionId : (saved?.selected_option_id ?? null);
          const isMarked = isCurrentActive ? isMarkedForReview : Boolean(saved?.is_marked_for_review);
          const tSpent = accumulatedTimePerQuestionRef.current.get(qId) || saved?.time_spent_seconds || 0;

          const switchCount = optionSwitchesCountRef.current.get(qId) || 0;

          return {
            question_id: qId,
            selected_option_id: selOpt,
            is_marked_for_review: isMarked,
            time_spent_seconds: Math.round(tSpent * 10) / 10,
            is_switched: switchCount > 0,
            option_switch_count: switchCount,
          };
        });

        await submitExamAttempt(attemptId, {
          submission_reason: 'USER_CLICKED_SUBMIT',
          responses: allFinalResponses.length > 0 ? allFinalResponses : undefined,
        });
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

  const [activeSectionId, setActiveSectionId] = useState<string>('all');

  // Dynamic Subjects Extraction for Exam Sidebar (Shows all subjects, hides topics/subtopics)
  const subjectSections: Section[] = React.useMemo(() => {
    if (!allQuestions || allQuestions.length === 0) {
      return [
        { id: 'all', label: 'All Subjects', total: totalQuestions, startQuestionNumber: 1, endQuestionNumber: totalQuestions }
      ];
    }
    const subjMap: Record<string, { total: number; startQNum: number; endQNum: number }> = {};
    allQuestions.forEach((q, idx) => {
      const qNum = (q as any).question_number || idx + 1;
      const subj = (q as any).subject || (q as any).section_code || 'General Studies';
      if (!subjMap[subj]) {
        subjMap[subj] = { total: 0, startQNum: qNum, endQNum: qNum };
      }
      subjMap[subj].total += 1;
      subjMap[subj].endQNum = qNum;
    });

    const result: Section[] = [
      { id: 'all', label: 'All Subjects', total: allQuestions.length, startQuestionNumber: 1, endQuestionNumber: allQuestions.length },
    ];
    Object.entries(subjMap).forEach(([name, data]) => {
      result.push({
        id: name,
        label: name,
        total: data.total,
        startQuestionNumber: data.startQNum,
        endQuestionNumber: data.endQNum,
      });
    });
    return result;
  }, [allQuestions, totalQuestions]);

  if (isLoadingSession) {
    return (
      <ExamLoaderOverlay
        title="Initializing Exam Session"
        subtitle="Loading questions, anti-cheat status, and timer configuration..."
      />
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
        examTitle={searchParams.get('exam') || "UPSC CSE"}
        paperSubtitle="UPSC CSE Prelims 2023 • GS Paper I"
        timeLeft={timeLeft}
        language={language}
        isSubmitting={isSubmitting}
        topicName={searchParams.get('topic') || 'General Studies'}
        subtopicName={searchParams.get('subtopic') || ''}
        parentBreadcrumb="Student Dashboard"
        onBack={() => {
          if (window.confirm('Are you sure you want to leave the examination? Your progress is saved automatically.')) {
            navigate('/dashboard');
          }
        }}
        onLanguageChange={setLanguage}
        onSubmitClick={handleOpenSubmitModal}
      />

      {/* Mobile Tab Switcher Bar (< 1024px) */}
      {isMobile && isPYQ && (
        <div
          style={{
            marginTop: 60,
            height: 44,
            backgroundColor: isDark ? '#0f1e3c' : '#ffffff',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
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
            { id: 'palette', label: 'Palette', icon: Grid },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id as any)}
                className="touch-target center-content"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 16px',
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: isActive ? '#E31B23' : 'transparent',
                  color: isActive ? '#ffffff' : isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748b',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: 36,
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
          marginTop: isMobile ? 104 : 60,
          marginBottom: 64,
          display: 'flex',
          flex: 1,
          height: isMobile ? 'calc(100vh - 168px)' : 'calc(100vh - 124px)',
          boxSizing: 'border-box',
          overflow: 'hidden',
          backgroundColor: '#F8FAFC',
        }}
      >
        {/* Center: Question Card Workspace with Collapsible Trigger Button */}
        {(!isMobile || mobileTab === 'question') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: isPYQ ? '0 24px' : 0, boxSizing: 'border-box' }}>
            {isLoadingQuestion ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F4F6F8' }}>
                <Loader2 size={24} className="animate-spin" color="#E31B23" />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#64748B' }}>Loading question #{currentQIndex + 1}...</span>
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
                onRevealAnswer={isPYQ ? undefined : handleRevealAnswer}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                isPYQ={isPYQ}
              />
            ) : null}
          </div>
        )}

        {/* Right: Question Palette (Kept for PYQ Tests) */}
        {isPYQ && (!isMobile || mobileTab === 'palette') && (
          <ExamQuestionPalette
            palette={palette.length > 0 ? palette : undefined}
            currentQIndex={currentQIndex}
            paletteFilter={paletteFilter}
            onSelectQuestion={handleSelectQuestionFromPalette}
            onFilterChange={setPaletteFilter}
            onRevealAnswer={undefined}
          />
        )}
      </div>

      {/* Sticky Bottom Control Bar */}
      <ExamFooterBar
        isAnswered={selectedOptionId !== null}
        isMarkedForReview={isMarkedForReview}
        isFirstQuestion={currentQIndex === 0}
        isLastQuestion={currentQIndex >= totalQuestions - 1}
        onClearResponse={handleClearResponse}
        onToggleMarkReview={handleToggleMarkReview}
        onSubmitAnswer={isPYQ ? undefined : handleRevealAnswer}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {/* Submit Confirmation Modal */}
      <ExamSubmitModal
        isOpen={showSubmitModal}
        answeredCount={liveResponseSummary.answered_count}
        markedCount={liveResponseSummary.marked_for_review_count}
        unattemptedCount={liveResponseSummary.unattempted_count}
        isSubmitting={isSubmitting}
        onResume={() => !isSubmitting && setShowSubmitModal(false)}
        onConfirmSubmit={handleConfirmSubmit}
      />

      {/* Guest Performance Scorecard Modal */}
      {showGuestScoreModal && guestScoreData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 500,
              backgroundColor: isDark ? '#172033' : '#ffffff',
              borderRadius: 0,
              padding: '32px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 0,
                backgroundColor: 'rgba(227, 27, 35, 0.1)',
                color: '#E31B23',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <Trophy size={28} />
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 900, color: isDark ? '#f8fafc' : '#172033', marginBottom: 4 }}>
              Guest Test Results
            </h2>

            <p style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 20 }}>
              Topic: <strong>{guestScoreData.topic}</strong> • Subtopic: <strong>{guestScoreData.subtopic}</strong>
            </p>

            {/* Score Pill */}
            <div
              style={{
                backgroundColor: isDark ? '#172033' : '#f0f6ff',
                borderRadius: 0,
                padding: '18px',
                marginBottom: 20,
                border: '1px solid rgba(227, 27, 35, 0.15)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#E31B23', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Your Estimated Score
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: isDark ? '#ffffff' : '#172033', margin: '4px 0' }}>
                {guestScoreData.score} <span style={{ fontSize: 18, color: '#64748b', fontWeight: 600 }}>/ {guestScoreData.totalScore}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#3A8B53' }}>
                Accuracy: {guestScoreData.accuracy}%
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div style={{ backgroundColor: isDark ? '#172033' : '#f8fafc', padding: 10, borderRadius: 0, border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>CORRECT</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#3A8B53' }}>{guestScoreData.correctCount}</div>
              </div>
              <div style={{ backgroundColor: isDark ? '#172033' : '#f8fafc', padding: 10, borderRadius: 0, border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>WRONG</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{guestScoreData.wrongCount}</div>
              </div>
              <div style={{ backgroundColor: isDark ? '#172033' : '#f8fafc', padding: 10, borderRadius: 0, border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>UNATTEMPTED</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#64748b' }}>{guestScoreData.unattemptedCount}</div>
              </div>
            </div>

            {/* CTA Box */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(227, 27, 35,0.06) 0%, rgba(124,58,237,0.06) 100%)',
                borderRadius: 0,
                padding: 16,
                marginBottom: 20,
                border: '1px solid rgba(227, 27, 35,0.2)',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#E31B23', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={15} /> Unlock Full 12-Matrix Psychometric Analysis
              </div>
              <div style={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.4 }}>
                Sign in or register for free to analyze your complete attempt with FSRS memory retention, cognitive depth breakdown, and AI study recommendations.
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthModalOpen(true);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 0,
                    border: 'none',
                    backgroundColor: '#E31B23',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <UserPlus size={16} /> Sign Up / Sign In to Analyze
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 0,
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'transparent',
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Back Home
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>Already registered?</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#E31B23',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Log In
                </button>
              </div>
            </div>

            <AuthModal
              isOpen={authModalOpen}
              mode={authMode}
              onClose={() => setAuthModalOpen(false)}
              onSwitchMode={(m) => setAuthMode(m)}
            />
          </div>
        </div>
      )}

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
          <Loader2 size={44} className="animate-spin" color="#E31B23" />
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

