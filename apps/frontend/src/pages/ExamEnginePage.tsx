import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ExamHeader } from '../components/exam/ExamHeader';
import { Section, Question } from '../components/exam/ExamSectionSidebar';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { QuestionSolutionData } from '../components/exam/QuestionSolutionMarkdownCard';
import { ExamQuestionPalette } from '../components/exam/ExamQuestionPalette';
import { ExamFooterBar } from '../components/exam/ExamFooterBar';
import { ExamSubmitModal } from '../components/exam/ExamSubmitModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { syncGuestSessionsOnAuth } from '../services/authService';
import { FileText, Layers, Grid, Loader2, Trophy, CheckCircle, XCircle, ArrowRight, UserPlus, RefreshCw } from 'lucide-react';
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
import { addBookmark, removeBookmark } from '../services/bookmarkService';
import { saveGuestAttempt } from '../utils/guestStorage';
import { AuthModal, AuthMode } from '../components/auth/AuthModal';
import { formatEnum, cleanExamTitle } from '../utils/formatEnum';

import {
  AttemptMode,
  QuestionNavResponse,
  QuestionOut,
  QuestionPaletteItem,
  RevealAnswerResponse,
  ResponseSummary,
  BatchSaveItem,
  ConfidenceLevel,
} from '../types/exam';

export function ExamEnginePage({ isGuest = false }: { isGuest?: boolean }) {
  const { examId, attemptId: paramAttemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isDark = false;

  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  const isLoggedIn = Boolean(token && user);

  const isGuestMode = isGuest || location.pathname === '/guest-exam' || examId === 'dynamic';

  // ─── Session State ───────────────────────────────────────────────────────────
  const [attemptId, setAttemptId] = useState<number | string | null>(paramAttemptId || null);
  const [attemptMode, setAttemptMode] = useState<AttemptMode>('EXAM');
  const [currentQIndex, setCurrentQIndex] = useState(0); // 0-indexed for UI
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [timeLeft, setTimeLeft] = useState(7200);
  const [language, setLanguage] = useState<string>(() => {
    try {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        if (u.preferred_language) return u.preferred_language;
      }
    } catch (_) {}
    return localStorage.getItem('preferred_language') || 'en';
  });
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'marked' | 'unanswered'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [isSyncingGuest, setIsSyncingGuest] = useState(false);

  // Guest Scorecard Modal State
  const [showGuestScoreModal, setShowGuestScoreModal] = useState(false);
  const [guestScoreData, setGuestScoreData] = useState<any>(null);
  const [isPYQ, setIsPYQ] = useState<boolean>(false);

  // Preloaded All Questions for Zero-Lag Client-Side Caching & Language Switching
  const [allQuestions, setAllQuestions] = useState<QuestionOut[]>([]);
  const BATCH_SIZE = 20;
  // A visit shorter than this (accidental click / flicking past) does not count as skipping the question
  const MIN_SKIP_DWELL_SECONDS = 2;
  const loadedBatchesRef = useRef<Set<number>>(new Set());
  const inFlightBatchesRef = useRef<Set<number>>(new Set());

  // Active question & responses
  const [activeQuestion, setActiveQuestion] = useState<QuestionNavResponse['question'] | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<number | string | null>(null);
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string | null>(null);
  const [isMarkedForReview, setIsMarkedForReview] = useState(false);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  // Per-question confidence, read by queueResponseUpdate so every save path carries it
  const confidenceByQRef = useRef<Map<string, ConfidenceLevel | null>>(new Map());
  // Round tracking: questions the student left unanswered (>= MIN_SKIP_DWELL_SECONDS), and the pass each answer was given in
  const leftUnansweredRef = useRef<Set<string>>(new Set());
  const answerRoundByQRef = useRef<Map<string, 1 | 2>>(new Map());
  // On resume: questions seen but left unanswered before the reload count as Round 2 when answered.
  // A fresh attempt already has its opening question VISITED; if nothing else was touched yet, that
  // question has not been left, so it is skipped.
  const seedLeftUnanswered = (items: QuestionPaletteItem[] | undefined, currentQuestionId?: string | number) => {
    const touched = (items || []).filter((item) => item.question_status !== 'UNVISITED');
    for (const item of touched) {
      if (touched.length === 1 && currentQuestionId != null && String(item.question_id) === String(currentQuestionId)) continue;
      if (item.question_status === 'VISITED' || item.question_status === 'MARKED_FOR_REVIEW') {
        leftUnansweredRef.current.add(String(item.question_id));
      }
    }
  };
  const [revealResults, setRevealResults] = useState<Record<string | number, RevealAnswerResponse>>({});
  const [solutionDataMap, setSolutionDataMap] = useState<Record<string | number, QuestionSolutionData>>({});
  const [palette, setPalette] = useState<QuestionPaletteItem[]>([]);
  const [responseSummary, setResponseSummary] = useState<ResponseSummary>({
    answered_count: 0,
    marked_for_review_count: 0,
    unattempted_count: 100,
    total: 100,
  });

  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});
  const { isTabletOrBelow, isSmallScreen } = useBreakpoint();
  const [mobileTab, setMobileTab] = useState<'question' | 'palette'>('question');

  // Question Time Telemetry tracking & Multi-Visit Dwell Accumulator
  const questionStartTimeRef = useRef<number>(Date.now());
  const accumulatedTimePerQuestionRef = useRef<Map<string, number>>(new Map());

  const getActiveQuestionTotalTime = (qId?: string | number) => {
    const rawId = qId || activeQuestion?.question_id;
    if (!rawId) return 0;
    const targetId = String(rawId);
    const prevAcc = accumulatedTimePerQuestionRef.current.get(targetId) || 0;
    const isActive = !qId || String(qId) === String(activeQuestion?.question_id);
    const currentVisit = isActive ? Math.max(0, (Date.now() - questionStartTimeRef.current) / 1000.0) : 0;
    return Math.max(0, prevAcc + currentVisit);
  };

  const saveQuestionVisitTime = (qId?: string | number) => {
    const rawId = qId || activeQuestion?.question_id;
    if (!rawId) return;
    const targetId = String(rawId);
    const elapsed = Math.max(0, (Date.now() - questionStartTimeRef.current) / 1000.0);
    const prevAcc = accumulatedTimePerQuestionRef.current.get(targetId) || 0;
    const newAcc = prevAcc + elapsed;
    accumulatedTimePerQuestionRef.current.set(targetId, newAcc);
    questionStartTimeRef.current = Date.now();
  };

  // ─── Asynchronous Batch Queue & Smart Dirty-Check Manager ─────────────────
  const pendingBatchQueueRef = useRef<Map<string, BatchSaveItem>>(new Map());
  const lastSyncedSnapshotRef = useRef<Map<string, { selected_option_id: string | number | null; is_marked_for_review: boolean; time_spent_seconds: number; confidence_level?: ConfidenceLevel | null }>>(new Map());
  const optionSwitchesCountRef = useRef<Map<string, number>>(new Map());
  const isSyncingBatchRef = useRef<boolean>(false);
  const autoSubmittedRef = useRef<boolean>(false);

  // Queue a modified response if it passes dirty-check verification
  const queueResponseUpdate = (
    questionId: string | number,
    optId: string | number | null,
    markedForRev: boolean,
    forcedTimeSpent?: number
  ) => {
    if (!questionId) return;
    const qKey = String(questionId);
    const timeSpent = forcedTimeSpent !== undefined ? forcedTimeSpent : getActiveQuestionTotalTime(questionId);
    const last = lastSyncedSnapshotRef.current.get(qKey);

    // Dirty-check verification: verify if genuinely modified to avoid false flags
    const isOptionModified = !last ? optId !== null : String(last.selected_option_id ?? '') !== String(optId ?? '');
    const isReviewModified = !last ? markedForRev : last.is_marked_for_review !== markedForRev;
    const isTimeModified = !last ? timeSpent > 0.2 : Math.abs((last.time_spent_seconds || 0) - timeSpent) >= 1.0;
    const conf = optId !== null ? confidenceByQRef.current.get(qKey) ?? null : null;
    const isConfidenceModified = !last ? conf !== null : (last.confidence_level ?? null) !== conf;

    const switchCount = optionSwitchesCountRef.current.get(qKey) || 0;

    if (isOptionModified || isReviewModified || isTimeModified || isConfidenceModified) {
      const item: BatchSaveItem = {
        question_id: questionId,
        selected_option_id: optId,
        is_marked_for_review: markedForRev,
        time_spent_seconds: Math.round(timeSpent * 10) / 10,
        is_switched: switchCount > 0,
        option_switch_count: switchCount,
        confidence_level: conf,
        answer_round: optId !== null ? answerRoundByQRef.current.get(qKey) ?? null : null,
        client_timestamp: new Date().toISOString(),
      };
      pendingBatchQueueRef.current.set(qKey, item);
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
          const k = String(item.question_id);
          lastSyncedSnapshotRef.current.set(k, {
            selected_option_id: item.selected_option_id ?? null,
            is_marked_for_review: Boolean(item.is_marked_for_review),
            time_spent_seconds: item.time_spent_seconds ?? 0,
            confidence_level: item.confidence_level ?? null,
          });
          // Remove confirmed item from pending queue
          pendingBatchQueueRef.current.delete(k);
        }

        if (ack.response_summary) {
          setResponseSummary(ack.response_summary);
        }
      }
    } catch (err) {
      console.warn(`[ExamEngine:FLUSH_ERROR] Batch '${batchId}' failed to sync, retaining ${itemsToSend.length} items in retry buffer:`, err);
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



  // ─── Batch Question Loader (20 questions at a time for complete PYQ exams) ───
  const loadQuestionBatch = useCallback(
    async (batchIdx: number, targetAttemptId?: string | number, lang: string = language) => {
      const attId = targetAttemptId || attemptId;
      if (!attId) return;
      if (loadedBatchesRef.current.has(batchIdx) || inFlightBatchesRef.current.has(batchIdx)) {
        return;
      }
      inFlightBatchesRef.current.add(batchIdx);
      const offset = batchIdx * BATCH_SIZE;
      try {
        const bulkData = await getAllAttemptQuestionsBulk(attId, lang, offset, BATCH_SIZE);
        if (bulkData.questions && bulkData.questions.length > 0) {
          loadedBatchesRef.current.add(batchIdx);
          setAllQuestions((prev) => {
            const nextQuestions = [...prev];
            bulkData.questions.forEach((q: QuestionOut, i: number) => {
              const targetIndex = offset + i;
              nextQuestions[targetIndex] = q;
            });
            return nextQuestions;
          });
        }
      } catch (err) {
        console.warn(`Failed to preload batch ${batchIdx} (offset: ${offset}):`, err);
      } finally {
        inFlightBatchesRef.current.delete(batchIdx);
      }
    },
    [attemptId, language]
  );

  // ─── 1. Session Initialization / Resume ─────────────────────────────────────
  useEffect(() => {
    async function initSession() {
      setIsLoadingSession(true);
      try {
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
        
        if (isPyqTest) {
          setIsPYQ(true);
        }

        if (isGuestMode) {
          await loadGuestSessionQuestions();
          return;
        }


        // Exam-type (PYQ vs Mock) confirmation runs in the background — a
        // synchronous heuristic above already set a reasonable default, and
        // this lookup doesn't gate correctness of starting/resuming the
        // attempt, so it must never block that critical path.
        listExams()
          .then((liveExams: ExamItem[]) => {
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
                setIsPYQ(true);
              } else if (
                match.exam_type === 'STATIC_MOCK' ||
                match.exam_type === 'MOCK' ||
                match.code?.toLowerCase().includes('mock') ||
                match.name?.toLowerCase().includes('mock')
              ) {
                setIsPYQ(false);
              }
            }
          })
          .catch((e) => console.warn('Exam type lookup warning:', e));

        setIsPYQ(isPyqTest);

        if (paramAttemptId) {
          // Resume existing session
          const sessionStatus = await getExamAttemptStatus(paramAttemptId);
          setAttemptId(sessionStatus.attempt_id);
          setAttemptMode(sessionStatus.mode);
          setTimeLeft(sessionStatus.remaining_seconds);
          setTotalQuestions(sessionStatus.total_questions);
          setPalette(sessionStatus.palette);
          seedLeftUnanswered(sessionStatus.palette, sessionStatus.palette?.[sessionStatus.current_question_index]?.question_id);
          setResponseSummary(sessionStatus.response_summary);
          setCurrentQIndex(sessionStatus.current_question_index);

          // Load just the current question first so the user can start
          // immediately — don't wait on the full bulk preload for that.
          await loadQuestion(sessionStatus.attempt_id, sessionStatus.current_question_index + 1);

          // In complete PYQ exams, load 20 questions in batches so initial start and transitions are fast
          const initialBatch = Math.floor(sessionStatus.current_question_index / BATCH_SIZE);
          loadQuestionBatch(initialBatch, sessionStatus.attempt_id, language);
          if ((initialBatch + 1) * BATCH_SIZE < sessionStatus.total_questions) {
            loadQuestionBatch(initialBatch + 1, sessionStatus.attempt_id, language);
          }
        } else if (examId) {
          // Start new attempt session
          const forceNew = searchParams.get('forceNew') === 'true';
          const startRes = await startExamAttempt({ exam_id: examId, mode: 'EXAM', language, force_new: forceNew });
          setAttemptId(startRes.attempt_id);
          setAttemptMode(startRes.mode);
          setTimeLeft(startRes.max_duration_seconds);
          setTotalQuestions(startRes.total_questions);
          setPalette(startRes.palette);
          // start also resumes an IN_PROGRESS attempt (page reload / Resume link)
          seedLeftUnanswered(startRes.palette, startRes.first_question.question.question_id);
          {
            const startRound = startRes.first_question.response_state.answer_round;
            if (startRound) answerRoundByQRef.current.set(String(startRes.first_question.question.question_id), startRound);
          }
          setActiveQuestion(startRes.first_question.question);
          setSelectedOptionId(startRes.first_question.response_state.selected_option_id as string | null);
          setIsMarkedForReview(startRes.first_question.response_state.is_marked_for_review);
          {
            const startConf = startRes.first_question.response_state.confidence_level ?? null;
            confidenceByQRef.current.set(String(startRes.first_question.question.question_id), startConf);
            setConfidence(startConf);
          }

          // Seed question 1 into memory
          setAllQuestions((prev) => {
            const next = [...prev];
            next[0] = startRes.first_question.question;
            return next;
          });

          // In complete PYQ exams, load questions in batches of 20 starting with Batch 0 (Q1-20)
          loadQuestionBatch(0, startRes.attempt_id, language);
          if (startRes.total_questions > BATCH_SIZE) {
            setTimeout(() => {
              loadQuestionBatch(1, startRes.attempt_id, language);
            }, 300);
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
    const gExam = searchParams.get('exam') || '';
    const gYear = searchParams.get('year') || '';
    const gSubject = searchParams.get('subject') || '';
    const gTopic = searchParams.get('topic') || '';
    const gSubtopic = searchParams.get('subtopic') || '';
    const gCount = parseInt(searchParams.get('count') || '10', 10);
    const gTime = parseInt(searchParams.get('time') || String(gCount * 120), 10);

    setTotalQuestions(gCount);
    setTimeLeft(gTime);
    setAttemptMode('EXAM');

    const apiParams = new URLSearchParams({
      limit: gCount.toString(),
    });

    if (gExam) apiParams.append('exam_name', gExam);
    if (gYear) apiParams.append('exam_year', gYear);
    if (gSubject && gSubject !== 'All Subjects') apiParams.append('subject_name', gSubject);
    if (gTopic && gTopic !== 'All Topics') apiParams.append('topic_name', gTopic);
    if (gSubtopic && gSubtopic !== 'All Subtopics') apiParams.append('subtopic_name', gSubtopic);

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
            translations: q.translations || {},
            passage_text: q.passage_text || null,
            passage_translations: q.passage_translations || {},
            options: (q.options || []).map((o: any) => ({
              option_id: o.option_id || `opt-${idx}-${o.option_label}`,
              option_label: o.option_label,
              text: o.option_text || o.text || `Option ${o.option_label}`,
              is_correct: Boolean(o.is_correct),
              translations: o.translations || {},
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

  // ─── On-demand Dynamic Translation Handler ──────────────────────────────────
  const [isTranslatingActiveQ, setIsTranslatingActiveQ] = useState(false);

  // Translation values from different backend endpoints aren't shaped the same:
  // the exam-session question-nav endpoints wrap question-level translations as
  // { question_text: "..." }, while the general question-detail endpoint (used
  // by the on-demand fetch below) returns plain strings. Normalize either shape
  // to a string so callers can safely call .trim() on the result.
  const toText = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.question_text || val.option_text || val.text || '';
    return '';
  };

  const ensureQuestionTranslation = useCallback(
    async (q: any, targetLang: string) => {
      if (!q || !q.question_id) return;
      const clean = (targetLang || 'en').trim().toLowerCase();
      if (clean === 'en' || clean === 'english') return;

      const upper = clean.toUpperCase();
      const langUpper = targetLang.toUpperCase(); // e.g. "HINDI" or "MARATHI"

      // Check if we already have a valid translation (not same as English source)
      const englishText = (toText(q.translations?.ENGLISH) || toText(q.translations?.en) || q.text || '').trim();

      const getStoredQTrans = () => {
        if (clean === 'hi' || clean === 'hindi') return q.text_hindi || q.textHindi;
        if (clean === 'mr' || clean === 'marathi') return q.text_marathi || q.textMarathi;
        return (
          q.translations &&
          toText(q.translations[langUpper] || q.translations[clean] || q.translations[upper])
        );
      };
      const storedQTrans = getStoredQTrans();
      const isQTransValid = storedQTrans && storedQTrans.trim() !== englishText;

      const hasValidOptionTrans =
        (q.options || []).length === 0 ||
        (q.options || []).every((o: any) => {
          const engOptText = (toText(o.translations?.ENGLISH) || toText(o.translations?.en) || o.text || '').trim();
          let stored =
            o.translations && toText(o.translations[langUpper] || o.translations[clean] || o.translations[upper]);
          if (clean === 'hi' || clean === 'hindi') stored = stored || o.text_hindi || o.textHindi;
          if (clean === 'mr' || clean === 'marathi') stored = stored || o.text_marathi || o.textMarathi;
          return stored && stored.trim() !== engOptText;
        });

      if (isQTransValid && hasValidOptionTrans) return;

      try {
        setIsTranslatingActiveQ(true);
        const res = await fetch(`/api/v1/questions/${q.question_id}?language=${targetLang}`);
        if (res.ok) {
          const data = await res.json();
          const newTrans = data.translations || {};
          const newOptTrans: Record<string, Record<string, string>> = {};
          const newOptText: Record<string, string> = {};
          (data.options || []).forEach((opt: any) => {
            if (opt.option_id) {
              const oId = String(opt.option_id);
              newOptTrans[oId] = opt.translations || {};
              // Store the chosen text for this language
              if (opt.text) newOptText[oId] = opt.text;
              else if (opt.option_text) newOptText[oId] = opt.option_text;
            }
          });

          const applyUpdates = (item: any) => {
            const mergedTranslations = { ...(item.translations || {}), ...newTrans };
            const fetchedText = data.text || data.question_text;
            if (fetchedText && fetchedText !== item.text) {
               mergedTranslations[langUpper] = fetchedText;
            }

            const mergedOptions = (item.options || []).map((o: any) => {
              const optId = String(o.option_id);
              const hiTxt = newOptTrans[optId]?.HINDI || newOptTrans[optId]?.hi;
              const mrTxt = newOptTrans[optId]?.MARATHI || newOptTrans[optId]?.mr;
              
              const mergedOptTrans = { ...(o.translations || {}), ...(newOptTrans[optId] || {}) };
              const fetchedOptText = newOptText[optId];
              if (fetchedOptText && fetchedOptText !== o.text) {
                 mergedOptTrans[langUpper] = fetchedOptText;
              }

              return {
                ...o,
                text: o.text, // Preserve original English text
                text_hindi: hiTxt || o.text_hindi,
                textHindi: hiTxt || o.textHindi,
                text_marathi: mrTxt || o.text_marathi,
                textMarathi: mrTxt || o.textMarathi,
                translations: mergedOptTrans,
              };
            });
            return {
              ...item,
              text: item.text, // Preserve original English text
              text_hindi: data.text_hindi || data.question_text_hindi || item.text_hindi,
              textHindi: data.text_hindi || data.question_text_hindi || item.textHindi,
              text_marathi: data.text_marathi || data.question_text_marathi || item.text_marathi,
              textMarathi: data.text_marathi || data.question_text_marathi || item.textMarathi,
              translations: mergedTranslations,
              options: mergedOptions,
            };
          };

          setAllQuestions((prev) =>
            prev.map((item) =>
              String(item.question_id) === String(q.question_id) ? applyUpdates(item) : item,
            ),
          );

          setActiveQuestion((prev) => {
            if (!prev || String(prev.question_id) !== String(q.question_id)) return prev;
            return applyUpdates(prev);
          });
        }
      } catch (err) {
        console.warn('On-demand translation fetch warning for PYQ exam:', err);
      } finally {
        setIsTranslatingActiveQ(false);
      }
    },
    [],
  );


  // ─── Helper: Fetch Specific Question ───────────────────────────────────────
  const loadQuestion = async (attId: number | string, qNum: number) => {
    // Record elapsed time on the outgoing question before switching
    if (activeQuestion) {
      // Leaving it unanswered after a real look means a later answer counts as Round 2
      const visitSeconds = (Date.now() - questionStartTimeRef.current) / 1000.0;
      if (selectedOptionId === null && visitSeconds >= MIN_SKIP_DWELL_SECONDS) {
        leftUnansweredRef.current.add(String(activeQuestion.question_id));
      }
      saveQuestionVisitTime(activeQuestion.question_id);
    }

    // Answered/marked before a page reload: the cached question carries no response state, so fetch
    // it from the server instead of showing it blank (a blank visit would save over the stored answer)
    const cachedQ = allQuestions[qNum - 1];
    const serverStatus = palette[qNum - 1]?.question_status;
    const needsServerState =
      !!cachedQ &&
      (serverStatus === 'ANSWERED' || serverStatus === 'ANSWERED_AND_MARKED' || serverStatus === 'MARKED_FOR_REVIEW') &&
      !lastSyncedSnapshotRef.current.has(String(cachedQ.question_id)) &&
      !pendingBatchQueueRef.current.has(String(cachedQ.question_id));

    if (cachedQ && !needsServerState) {
      // Instant Client-Side Zero-Lag Question Flipping
      questionStartTimeRef.current = Date.now();
      const q = allQuestions[qNum - 1];
      setActiveQuestion(q);
      const qKey = String(q.question_id);
      const saved = lastSyncedSnapshotRef.current.get(qKey) || pendingBatchQueueRef.current.get(qKey);
      if (saved) {
        setSelectedOptionId(saved.selected_option_id != null ? String(saved.selected_option_id) : null);
        setIsMarkedForReview(Boolean(saved.is_marked_for_review));
        setConfidence(confidenceByQRef.current.get(qKey) ?? saved.confidence_level ?? null);
        const matched = q.options?.find((o: any) => String(o.option_id) === String(saved.selected_option_id));
        setSelectedOptionLabel(matched ? matched.option_label : null);
      } else {
        setSelectedOptionId(null);
        setSelectedOptionLabel(null);
        setIsMarkedForReview(false);
        setConfidence(confidenceByQRef.current.get(qKey) ?? null);
      }

      // Ensure active question translations if needed
      ensureQuestionTranslation(q, language);
      if (allQuestions[qNum]) {
        ensureQuestionTranslation(allQuestions[qNum], language);
      }
      return;
    }

    // Question not in cache yet: immediately trigger its 20-question batch
    const targetBatch = Math.floor((qNum - 1) / BATCH_SIZE);
    loadQuestionBatch(targetBatch, attId, language);

    setIsLoadingQuestion(true);
    questionStartTimeRef.current = Date.now();
    try {
      const qNav = await getQuestionByNumber(attId, qNum, language);
      setActiveQuestion(qNav.question);
      setSelectedOptionId(qNav.response_state.selected_option_id as string | null);
      setIsMarkedForReview(qNav.response_state.is_marked_for_review);
      {
        const fetchedConf = qNav.response_state.confidence_level ?? null;
        confidenceByQRef.current.set(String(qNav.question.question_id), fetchedConf);
        setConfidence(fetchedConf);
        const fetchedRound = qNav.response_state.answer_round;
        if (fetchedRound) answerRoundByQRef.current.set(String(qNav.question.question_id), fetchedRound);
      }

      // Seed question into cache
      setAllQuestions((prev) => {
        const next = [...prev];
        next[qNum - 1] = qNav.question;
        return next;
      });

      // Find matching label
      const matchedOpt = qNav.question.options.find((o) => o.option_id === qNav.response_state.selected_option_id);
      setSelectedOptionLabel(matchedOpt ? matchedOpt.option_label : null);

      // Ensure translation for fetched question if missing
      ensureQuestionTranslation(qNav.question, language);

      // Background prefetching for instant zero-lag next question switching
      if (qNum + 1 <= totalQuestions) {
        prefetchQuestion(attId, qNum + 1, language);
      }
      if (qNum + 2 <= totalQuestions) {
        prefetchQuestion(attId, qNum + 2, language);
      }
    } catch (err) {
      console.error('Failed to fetch question by number:', err);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    localStorage.setItem('preferred_language', newLang);
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        fetch('/api/v1/auth/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferred_language: newLang }),
        }).catch(() => {});
      }
    } catch (_) {}

    // Priority translate active question if missing in newLang
    if (activeQuestion) {
      ensureQuestionTranslation(activeQuestion, newLang);
    }
    // Background prefetch next question if present
    if (allQuestions[currentQIndex + 1]) {
      ensureQuestionTranslation(allQuestions[currentQIndex + 1], newLang);
    }

    // Refresh loaded question batches in background with new language
    if (attemptId) {
      loadedBatchesRef.current.forEach((batchIdx) => {
        const offset = batchIdx * BATCH_SIZE;
        getAllAttemptQuestionsBulk(attemptId, newLang, offset, BATCH_SIZE)
          .then((bulkData) => {
            if (bulkData.questions && bulkData.questions.length > 0) {
              setAllQuestions((prev) => {
                const nextQ = [...prev];
                bulkData.questions.forEach((q: QuestionOut, i: number) => {
                  nextQ[offset + i] = q;
                });
                return nextQ;
              });
            }
          })
          .catch((err) => console.warn(`Batch ${batchIdx} language refresh warning:`, err));
      });
    }
  };


  // ─── Live Countdown & Heartbeat Sync ─────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Immediate Auto-Submission when Timer reaches 0
  useEffect(() => {
    if (isLoadingSession || !attemptId || timeLeft > 0 || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    handleConfirmSubmit('TIMER_EXPIRED');
  }, [timeLeft, isLoadingSession, attemptId]);

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
          navigate(`/analytics?attemptId=${attemptId}`);
        }
      } catch (err) {
        console.warn('Heartbeat sync warning:', err);
      }
    }, 15000);

    return () => clearInterval(heartbeatInterval);
  }, [attemptId, timeLeft, activeQuestion]);

  // ─── Zero-Lag Action Handlers with Asynchronous Batching ──────────────────────
  const handleToggleBookmark = async () => {
    if (!activeQuestion) return;
    const qId = String(activeQuestion.question_id || (activeQuestion as any).id);
    const isBookmarked = !!bookmarkedQs[currentQIndex];
    
    // Optimistic update
    setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !isBookmarked }));
    
    try {
      if (isBookmarked) {
        await removeBookmark(qId);
      } else {
        await addBookmark(qId);
      }
    } catch (err) {
      console.error("Failed to toggle bookmark", err);
      // Revert on failure
      setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: isBookmarked }));
    }
  };

  const handleSelectOption = (optionId: number | string, optionLabel: string) => {
    if (activeQuestion) {
      const qKey = String(activeQuestion.question_id);
      if (!answerRoundByQRef.current.has(qKey)) {
        answerRoundByQRef.current.set(qKey, leftUnansweredRef.current.has(qKey) ? 2 : 1);
      }
      const prevOpt = selectedOptionId || lastSyncedSnapshotRef.current.get(qKey)?.selected_option_id;
      if (prevOpt && String(prevOpt) !== String(optionId)) {
        const curCount = (optionSwitchesCountRef.current.get(qKey) || 0) + 1;
        optionSwitchesCountRef.current.set(qKey, curCount);
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
    setConfidence(null);
    if (activeQuestion) {
      confidenceByQRef.current.set(String(activeQuestion.question_id), null);
      answerRoundByQRef.current.delete(String(activeQuestion.question_id));
    }

    const newStatus = isMarkedForReview ? 'MARKED_FOR_REVIEW' : 'VISITED';
    updatePaletteItemStatus(currentQIndex, newStatus);

    if (activeQuestion) {
      queueResponseUpdate(activeQuestion.question_id, null, isMarkedForReview);
    }
  };

  const handleConfidenceChange = (value: ConfidenceLevel | null) => {
    if (!activeQuestion || selectedOptionId === null) return;
    confidenceByQRef.current.set(String(activeQuestion.question_id), value);
    setConfidence(value);
    queueResponseUpdate(activeQuestion.question_id, selectedOptionId, isMarkedForReview);
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

  const handleShowSolution = async (targetId?: string | number) => {
    const qId = targetId || activeQuestion?.question_id;
    if (!qId) return;
    try {
      const res = await fetch(`/api/v1/questions/${qId}/solution`);
      if (res.ok) {
        const data: QuestionSolutionData = await res.json();
        setSolutionDataMap((prev) => ({
          ...prev,
          [qId]: data,
          [String(qId)]: data,
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch detailed solution in ExamEnginePage:', err);
    }
  };

  const handleRevealAnswer = async () => {
    if (!attemptId || !activeQuestion) return;
    setIsRevealing(true);
    try {
      const revRes = await revealQuestionAnswer(attemptId, activeQuestion.question_id);
      setRevealResults((prev) => ({ ...prev, [activeQuestion.question_id]: revRes }));
      handleShowSolution(activeQuestion.question_id);
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

  const markAsVisited = (idx: number) => {
    setPalette((prev) => {
      if (!prev || idx >= prev.length) return prev;
      const copy = [...prev];
      const curStatus = copy[idx]?.question_status;
      if (!curStatus || curStatus === 'UNVISITED') {
        copy[idx] = {
          ...copy[idx],
          question_number: idx + 1,
          question_status: 'VISITED',
        };
      }
      return copy;
    });
  };

  const handleNext = async () => {
    saveCurrentResponse();
    if (currentQIndex < totalQuestions - 1) {
      const nextIdx = currentQIndex + 1;
      setCurrentQIndex(nextIdx);
      markAsVisited(nextIdx);
      if (attemptId) {
        // Proactively preload next batch of 20 as we move ahead
        const currentBatch = Math.floor(nextIdx / BATCH_SIZE);
        const nextBatch = currentBatch + 1;
        if (nextBatch * BATCH_SIZE < totalQuestions) {
          loadQuestionBatch(nextBatch);
        }
      }
      await loadQuestion(attemptId || 'guest', nextIdx + 1);
      if (isTabletOrBelow) setMobileTab('question');
    }
  };

  const handlePrev = async () => {
    saveCurrentResponse();
    if (currentQIndex > 0) {
      const prevIdx = currentQIndex - 1;
      setCurrentQIndex(prevIdx);
      markAsVisited(prevIdx);
      if (attemptId) {
        const targetBatch = Math.floor(prevIdx / BATCH_SIZE);
        loadQuestionBatch(targetBatch);
      }
      await loadQuestion(attemptId || 'guest', prevIdx + 1);
      if (isTabletOrBelow) setMobileTab('question');
    }
  };

  const handleSelectQuestionFromPalette = async (idx: number) => {
    saveCurrentResponse();
    setCurrentQIndex(idx);
    markAsVisited(idx);
    if (attemptId) {
      // Ensure target batch of 20 is loaded for palette jump
      const targetBatch = Math.floor(idx / BATCH_SIZE);
      loadQuestionBatch(targetBatch);
      if ((targetBatch + 1) * BATCH_SIZE < totalQuestions) {
        loadQuestionBatch(targetBatch + 1);
      }
    }
    await loadQuestion(attemptId || 'guest', idx + 1);
    if (isTabletOrBelow) setMobileTab('question');
  };

  const handleConfirmSubmit = async (reasonInput?: unknown) => {
    const reason: 'USER_CLICKED_SUBMIT' | 'TIMER_EXPIRED' =
      typeof reasonInput === 'string' && (reasonInput === 'TIMER_EXPIRED' || reasonInput === 'USER_CLICKED_SUBMIT')
        ? reasonInput
        : 'USER_CLICKED_SUBMIT';

    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    if (isGuestMode || !attemptId) {
      let correctCount = 0;
      let wrongCount = 0;
      let unattemptedCount = 0;

      allQuestions.forEach((q) => {
        const qKey = String(q.question_id);
        const saved = lastSyncedSnapshotRef.current.get(qKey) || pendingBatchQueueRef.current.get(qKey);
        const selId = saved?.selected_option_id;
        if (!selId) {
          unattemptedCount++;
        } else {
          const opt = q.options?.find((o: any) => String(o.option_id) === String(selId));
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
        const qKey = String(qId);
        const selOpt = selectedOptionId || lastSyncedSnapshotRef.current.get(qKey)?.selected_option_id;
        const rev = revealResults[qKey] || revealResults[qId];
        return {
          question_id: qId,
          selected_option_id: selOpt || null,
          is_correct: Boolean(rev?.is_user_correct),
          time_taken_seconds: accumulatedTimePerQuestionRef.current.get(qKey) || 60.0,
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
        if (activeQuestion) {
          queueResponseUpdate(activeQuestion.question_id, selectedOptionId, isMarkedForReview);
        }
        await flushPendingBatches();

        const allFinalResponses = (palette.length > 0 ? palette : (allQuestions || []).filter(Boolean)).map((item: any) => {
          const qId = item.question_id;
          const qKey = String(qId);
          const isCurrentActive = String(activeQuestion?.question_id) === qKey;
          const saved = lastSyncedSnapshotRef.current.get(qKey) || pendingBatchQueueRef.current.get(qKey);
          const selOpt = isCurrentActive ? selectedOptionId : (saved?.selected_option_id ?? null);
          const isMarked = isCurrentActive ? isMarkedForReview : Boolean(saved?.is_marked_for_review);
          const tSpent = accumulatedTimePerQuestionRef.current.get(qKey) || saved?.time_spent_seconds || 0;

          const switchCount = optionSwitchesCountRef.current.get(qKey) || 0;

          return {
            question_id: qId,
            selected_option_id: selOpt != null ? String(selOpt) : null,
            is_marked_for_review: isMarked,
            time_spent_seconds: Math.round(tSpent * 10) / 10,
            is_switched: switchCount > 0,
            option_switch_count: switchCount,
            confidence_level: selOpt != null ? confidenceByQRef.current.get(qKey) ?? saved?.confidence_level ?? null : null,
            answer_round: selOpt != null ? answerRoundByQRef.current.get(qKey) ?? null : null,
          };
        });

        await submitExamAttempt(attemptId, {
          submission_reason: reason,
          responses: allFinalResponses.length > 0 ? allFinalResponses : undefined,
        });
        setShowSubmitModal(false);
        navigate(`/analytics?attemptId=${attemptId}`);
      } else {
        setShowSubmitModal(false);
        navigate('/analytics');
      }
    } catch (err: any) {
      console.error('Failed to submit exam attempt:', err);
      setSubmitError(err.message || 'Failed to submit exam attempt. Please try again.');
    } finally {
      setIsSubmitting(false);
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
    const validQuestions = (allQuestions || []).filter(Boolean);
    if (validQuestions.length === 0) {
      return [
        { id: 'all', label: 'All Subjects', total: totalQuestions, startQuestionNumber: 1, endQuestionNumber: totalQuestions }
      ];
    }
    const subjMap: Record<string, { total: number; startQNum: number; endQNum: number }> = {};
    validQuestions.forEach((q, idx) => {
      const qNum = (q as any).question_number || idx + 1;
      const subj = (q as any).subject || (q as any).section_code || 'General Studies';
      if (!subjMap[subj]) {
        subjMap[subj] = { total: 0, startQNum: qNum, endQNum: qNum };
      }
      subjMap[subj].total += 1;
      subjMap[subj].endQNum = qNum;
    });

    const result: Section[] = [
      { id: 'all', label: 'All Subjects', total: totalQuestions || validQuestions.length, startQuestionNumber: 1, endQuestionNumber: totalQuestions || validQuestions.length },
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
        examTitle={cleanExamTitle(searchParams.get('exam') || "UPSC CSE")}
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
        onLanguageChange={handleLanguageChange}
        onSubmitClick={handleOpenSubmitModal}
      />

      {/* In-Page Show Report Pill Banner for Practice & Guest Exams */}
      {guestScoreData && (
        <div
          style={{
            position: 'fixed',
            top: isTabletOrBelow ? 104 : 64,
            right: 24,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setShowGuestScoreModal(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--primary-red)',
              color: 'var(--bg-card)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(var(--primary-red-rgb), 0.3)',
              transition: 'transform 0.15s ease',
            }}
          >
            <Trophy size={16} />
            <span>Show Test Report ({guestScoreData.score}/{guestScoreData.totalScore || guestScoreData.totalMarksPossible})</span>
          </button>
        </div>
      )}

      {/* Mobile/Tablet Tab Switcher Bar (<= 834px) */}
      {isTabletOrBelow && isPYQ && (
        <div
          style={{
            marginTop: 60,
            height: 44,
            backgroundColor: isDark ? '#0f1e3c' : 'var(--bg-card)',
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)'}`,
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
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--primary-red)' : 'transparent',
                  color: isActive ? 'var(--bg-card)' : isDark ? 'rgba(255, 255, 255, 0.7)' : 'var(--text-muted)',
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
          marginTop: isTabletOrBelow ? 116 : 76,
          marginBottom: isTabletOrBelow ? (isSmallScreen ? 120 : 76) : 80,
          display: 'flex',
          flexDirection: isTabletOrBelow ? 'column' : 'row',
          height: isTabletOrBelow ? 'auto' : 'calc(100vh - 156px)',
          minHeight: isTabletOrBelow ? 'calc(100vh - 192px)' : 0,
          boxSizing: 'border-box',
          overflow: isTabletOrBelow ? 'visible' : 'hidden',
          backgroundColor: 'var(--bg-subtle)',
        }}
      >
        {/* Center: Question Card Workspace with Collapsible Trigger Button */}
        {(!isTabletOrBelow || mobileTab === 'question') && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: isTabletOrBelow ? 'auto' : '100%', minHeight: 0, padding: isPYQ ? '0 24px' : 0, boxSizing: 'border-box' }}>
            {isLoadingQuestion ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F4F6F8' }}>
                <Loader2 size={24} className="animate-spin" color="var(--primary-red)" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Loading question #{currentQIndex + 1}...</span>
              </div>
            ) : activeQuestion ? (
              <ExamQuestionCard
                reportable
                question={activeQuestion}
                questionIndex={currentQIndex}
                totalQuestions={totalQuestions}
                selectedOptionId={selectedOptionId}
                selectedOptionLabel={selectedOptionLabel}
                isBookmarked={!!bookmarkedQs[currentQIndex]}
                language={language}
                mode={attemptMode}
                revealResult={activeQuestion ? revealResults[activeQuestion.question_id] : null}
                solutionData={activeQuestion ? solutionDataMap[activeQuestion.question_id] || solutionDataMap[String(activeQuestion.question_id)] || null : null}
                isRevealing={isRevealing}
                onSelectOption={handleSelectOption}
                onToggleBookmark={handleToggleBookmark}
                onRevealAnswer={isPYQ ? undefined : handleRevealAnswer}
                onShowSolution={() => handleShowSolution()}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                isPYQ={isPYQ}
              />
            ) : null}
          </div>
        )}

        {/* Right: Question Palette (Kept for PYQ Tests) */}
        {isPYQ && (!isTabletOrBelow || mobileTab === 'palette') && (
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
        confidence={confidence}
        onConfidenceChange={handleConfidenceChange}
        isFirstQuestion={currentQIndex === 0}
        isLastQuestion={currentQIndex >= totalQuestions - 1}
        onClearResponse={handleClearResponse}
        onToggleMarkReview={handleToggleMarkReview}
        onSubmitAnswer={isPYQ ? undefined : handleRevealAnswer}
        onPrev={handlePrev}
        onNext={handleNext}
        onSubmitTest={handleOpenSubmitModal}
      />

      {/* Submit Confirmation Modal */}
      <ExamSubmitModal
        isOpen={showSubmitModal}
        answeredCount={liveResponseSummary.answered_count}
        markedCount={liveResponseSummary.marked_for_review_count}
        unattemptedCount={liveResponseSummary.unattempted_count}
        isSubmitting={isSubmitting}
        errorMessage={submitError}
        onResume={() => {
          if (!isSubmitting) {
            setSubmitError(null);
            setShowSubmitModal(false);
          }
        }}
        onConfirmSubmit={() => handleConfirmSubmit('USER_CLICKED_SUBMIT')}
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
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              padding: '32px',
              border: `1px solid ${isDark ? 'var(--text-secondary)' : 'var(--border-color)'}`,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius)',
                backgroundColor: 'rgba(var(--primary-red-rgb), 0.1)',
                color: 'var(--primary-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <Trophy size={28} />
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 900, color: isDark ? 'var(--bg-subtle)' : 'var(--deep-navy)', marginBottom: 4 }}>
              {isLoggedIn ? 'Simulation Results' : 'Guest Test Results'}
            </h2>

            <p style={{ fontSize: 13, color: isDark ? 'var(--text-disabled)' : 'var(--text-muted)', marginBottom: 20 }}>
              Topic: <strong>{formatEnum(guestScoreData.topic)}</strong> • Subtopic: <strong>{formatEnum(guestScoreData.subtopic)}</strong>
            </p>

            {/* Score Pill */}
            <div
              style={{
                backgroundColor: isDark ? 'var(--deep-navy)' : '#f0f6ff',
                borderRadius: 'var(--radius)',
                padding: '18px',
                marginBottom: 20,
                border: '1px solid rgba(var(--primary-red-rgb), 0.15)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-red)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Your Estimated Score
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: isDark ? 'var(--bg-card)' : 'var(--deep-navy)', margin: '4px 0' }}>
                {guestScoreData.score} <span style={{ fontSize: 18, color: 'var(--text-muted)', fontWeight: 600 }}>/ {guestScoreData.totalScore}</span>
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
              <div style={{ backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-subtle)', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>CORRECT</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#3A8B53' }}>{guestScoreData.correctCount}</div>
              </div>
              <div style={{ backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-subtle)', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>WRONG</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-red)' }}>{guestScoreData.wrongCount}</div>
              </div>
              <div style={{ backgroundColor: isDark ? 'var(--deep-navy)' : 'var(--bg-subtle)', padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>UNATTEMPTED</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-muted)' }}>{guestScoreData.unattemptedCount}</div>
              </div>
            </div>

            {/* CTA Box */}
            {!isLoggedIn && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--primary-red-rgb), 0.06) 0%, rgba(124,58,237,0.06) 100%)',
                  borderRadius: 'var(--radius)',
                  padding: 16,
                  marginBottom: 20,
                  border: '1px solid rgba(var(--primary-red-rgb), 0.2)',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary-red)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Trophy size={15} /> Unlock Full 12-Matrix Psychometric Analysis
                </div>
                <div style={{ fontSize: 12, color: isDark ? 'var(--border-color)' : 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Sign in or register for free to analyze your complete attempt with FSRS memory retention, cognitive depth breakdown, and AI study recommendations.
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {isLoggedIn ? (
                  <button
                    type="button"
                    disabled={isSyncingGuest}
                    onClick={async () => {
                      if (token) {
                        try {
                          setIsSyncingGuest(true);
                          await syncGuestSessionsOnAuth(token);
                        } catch (err) {
                          console.warn('Failed to sync guest session:', err);
                        } finally {
                          setIsSyncingGuest(false);
                        }
                      }
                      setShowGuestScoreModal(false);
                      const targetId = sessionStorage.getItem('latest_synced_attempt_id') || guestScoreData?.attemptId;
                      if (targetId) {
                        navigate(`/analytics?attemptId=${encodeURIComponent(targetId)}`);
                      } else {
                        navigate('/analytics');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 'var(--radius)',
                      border: 'none',
                      backgroundColor: 'var(--primary-red)',
                      color: 'var(--bg-card)',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: isSyncingGuest ? 'not-allowed' : 'pointer',
                      opacity: isSyncingGuest ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {isSyncingGuest ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} /> Generate Diagnostic Report
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthModalOpen(true);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      borderRadius: 'var(--radius)',
                      border: 'none',
                      backgroundColor: 'var(--primary-red)',
                      color: 'var(--bg-card)',
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
                )}
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'transparent',
                    color: isDark ? 'var(--border-color)' : 'var(--text-secondary)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Back Home
                </button>
              </div>

              {/* Review on this page button */}
              <button
                type="button"
                onClick={() => setShowGuestScoreModal(false)}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: isDark ? '#1e293b' : 'var(--bg-subtle)',
                  color: isDark ? 'var(--bg-subtle)' : '#1e293b',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Review Questions & Solutions on This Page
              </button>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: isDark ? 'var(--text-disabled)' : 'var(--text-muted)' }}>Already registered?</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-red)',
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
            color: 'var(--bg-card)',
            gap: 16,
          }}
        >
          <Loader2 size={44} className="animate-spin" color="var(--primary-red)" />
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

