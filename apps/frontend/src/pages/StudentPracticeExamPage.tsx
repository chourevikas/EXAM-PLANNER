import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SlidersHorizontal,
  ChevronDown,
  Check,
  Search,
  CheckCircle2,
  Sparkles,
  X,
  Lightbulb,
} from 'lucide-react';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { GuestScoreModal } from '../components/exam/GuestScoreModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { RecommendedQuestionsPanel } from '../components/exam/RecommendedQuestionsPanel';
import { QuestionSolutionData } from '../components/exam/QuestionSolutionMarkdownCard';
import { QuestionOut, QuestionPaletteItem, RevealAnswerResponse } from '../types/exam';
import { fetchMasterSyllabus, verifySyllabusNode, listExams } from '../services/examService';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { addBookmark, removeBookmark, listBookmarks } from '../services/bookmarkService';
import { saveGuestAttempt } from '../utils/guestStorage';
import { formatEnum } from '../utils/formatEnum';
import { guardedFetch } from '../utils/apiGuard';

export function StudentPracticeExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL Params
  const gExam = searchParams.get('exam') || 'UPSC CSE';
  const gYear = searchParams.get('year') || '';
  const gSubject = searchParams.get('subject') || searchParams.get('topic') || '';
  const gTopic = searchParams.get('topic') || '';
  const gSubtopic = searchParams.get('subtopic') || '';
  const gDifficulty = searchParams.get('difficulty') || '';
  const gCount = parseInt(searchParams.get('count') || '10', 10);

  // Interactive Filter Bar Popover State
  const [activeDropdown, setActiveDropdown] = useState<
    'exam' | 'subject' | 'topic' | 'difficulty' | null
  >(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Master Syllabus Taxonomy & Available Exams state fetched directly from live APIs
  const [masterSyllabus, setMasterSyllabus] = useState<any>(null);
  const [availableExams, setAvailableExams] = useState<string[]>([]);

  // Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(gCount);
  const [timeLeft, setTimeLeft] = useState(600); // Exactly 10 mins (600s)
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'marked' | 'unanswered'>(
    'all',
  );
  const [isLoading, setIsLoading] = useState(true);

  // Collapsible Left Drawer State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Question & Response Data
  const [allQuestions, setAllQuestions] = useState<QuestionOut[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionOut | null>(null);
  const [userResponses, setUserResponses] = useState<
    Record<string | number, { optionId: number | string; optionLabel: string }>
  >({});
  const [revealedMap, setRevealedMap] = useState<Record<string, RevealAnswerResponse>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});
  const [palette, setPalette] = useState<QuestionPaletteItem[]>([]);

  // Modal & Popup States
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showNoMoreQuestionsModal, setShowNoMoreQuestionsModal] = useState(false);
  const [guestScoreData, setGuestScoreData] = useState<any>(null);
  const [scoreCountdown, setScoreCountdown] = useState<number | null>(null);

  // Dynamic Recommended Questions Pool
  const [recommendedPool, setRecommendedPool] = useState<QuestionOut[]>([]);
  const [expandedRecId, setExpandedRecId] = useState<number | string | null>(null);
  const [recUserResponses, setRecUserResponses] = useState<Record<string, number | string>>({});
  const [recSolutions, setRecSolutions] = useState<Record<string | number, QuestionSolutionData>>(
    {},
  );
  const [recSolutionLoading, setRecSolutionLoading] = useState<Record<string | number, boolean>>(
    {},
  );
  const [isSolutionLoading, setIsSolutionLoading] = useState(false);
  const expandedRecIdRef = React.useRef<number | string | null>(null);
  const recUserResponsesRef = React.useRef<Record<string, number | string>>({});
  const userToggledRecRef = React.useRef(false);

  useEffect(() => {
    expandedRecIdRef.current = expandedRecId;
  }, [expandedRecId]);

  useEffect(() => {
    recUserResponsesRef.current = recUserResponses;
  }, [recUserResponses]);

  const [isPrefetchingRecs, setIsPrefetchingRecs] = useState(false);
  const [isRecsExhausted, setIsRecsExhausted] = useState(false);

  // Reset recommendations exhaustion when exam/subject/topic filters change
  useEffect(() => {
    setIsRecsExhausted(false);
    setRecommendedPool([]);
  }, [gExam, gSubject, gTopic, gSubtopic]);

  const userResponsesRef = React.useRef(userResponses);
  userResponsesRef.current = userResponses;
  const revealedMapRef = React.useRef(revealedMap);
  revealedMapRef.current = revealedMap;

  // Background prefetch function for dynamic recommended questions
  const prefetchRecommendations = useCallback(
    async (currentTestQuestions: QuestionOut[], currentPool: QuestionOut[]) => {
      if (isPrefetchingRecs || isRecsExhausted) return;
      setIsPrefetchingRecs(true);

      try {
        const existingIds = new Set<string | number>();
        currentTestQuestions.forEach((q) => {
          if (q.question_id) existingIds.add(q.question_id);
        });
        currentPool.forEach((q) => {
          if (q.question_id) existingIds.add(q.question_id);
        });
        Object.keys(userResponsesRef.current || {}).forEach((qId) => existingIds.add(qId));
        Object.keys(revealedMapRef.current || {}).forEach((qId) => existingIds.add(qId));
        Object.keys(recUserResponsesRef.current || {}).forEach((qId) => existingIds.add(qId));

        const excludeIdsParam = Array.from(existingIds).join(',');

        const rawSubject = gSubject && !gSubject.startsWith('All Subjects') ? gSubject.trim() : '';
        let querySubject = rawSubject;
        let queryTopic = gTopic && !gTopic.startsWith('All Topics') ? gTopic.trim() : '';
        const targetExam = gExam
          ? gExam.toLowerCase().includes('upsc')
            ? 'upsc'
            : gExam.toLowerCase().trim()
          : '';

        if (querySubject || queryTopic) {
          try {
            const verifyRes = await verifySyllabusNode({
              subject: querySubject,
              topic: queryTopic,
            });
            if (verifyRes && verifyRes.is_valid) {
              if (verifyRes.canonical_subject) querySubject = verifyRes.canonical_subject;
              if (verifyRes.canonical_topic) queryTopic = verifyRes.canonical_topic;
            }
          } catch (err) {
            // ignore verification fallback
          }
        }

        let newFetched: any[] = [];

        // Fetch exactly enough to fill the pool to its 15-item cap in one round
        // trip, instead of always asking for 5 — the effect that calls this
        // function re-fires as long as the pool is under 15, so a fixed
        // limit:'5' meant filling an empty pool took 3 sequential rounds (up to
        // 6 network calls) instead of 1.
        const neededCount = Math.max(1, 15 - currentPool.length);

        // Step 1: Query API by Topic first if a topic is selected
        if (queryTopic) {
          const topicParams = new URLSearchParams({ limit: String(neededCount) });
          topicParams.append('topic_name', queryTopic);
          if (querySubject) topicParams.append('subject_name', querySubject);
          if (targetExam) topicParams.append('exam_name', targetExam);
          if (excludeIdsParam) topicParams.append('exclude_ids', excludeIdsParam);

          try {
            const res = await guardedFetch(
              `/api/v1/questions/recommended?${topicParams.toString()}`,
            );
            if (res.ok) {
              const data = await res.json();
              newFetched = data.items || [];
            }
          } catch (err) {
            console.warn('Topic recommendation fetch failed:', err);
          }
        }

        // Step 2: Fallback to Subject if no questions found for Topic (or if no Topic was selected)
        if (newFetched.length === 0 && querySubject) {
          const subjParams = new URLSearchParams({ limit: String(neededCount) });
          subjParams.append('subject_name', querySubject);
          if (targetExam) subjParams.append('exam_name', targetExam);
          if (excludeIdsParam) subjParams.append('exclude_ids', excludeIdsParam);

          try {
            const res = await guardedFetch(
              `/api/v1/questions/recommended?${subjParams.toString()}`,
            );
            if (res.ok) {
              const data = await res.json();
              newFetched = data.items || [];
            }
          } catch (err) {
            console.warn('Subject recommendation fetch failed:', err);
          }
        }

        // Step 3: If no questions even of subject are found, mark exhausted and DO NOT call API in loop
        if (newFetched.length === 0) {
          setIsRecsExhausted(true);
          return;
        }

        if (newFetched.length > 0) {
          const formatted: QuestionOut[] = newFetched.map((item: any, idx: number) => {
            const rawOptions = item.options || [];
            const optionsList = rawOptions.map((o: any, oIdx: number) => ({
              option_id:
                o.option_id || `opt-rec-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
              option_label: o.option_label || String.fromCharCode(65 + oIdx),
              text:
                o.option_text ||
                o.text ||
                `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
              is_correct: Boolean(o.is_correct),
              distractor_analysis:
                o.distractor_analysis ||
                o.explanation ||
                o.description ||
                (o.is_correct
                  ? 'Correct option matching core syllabus concepts.'
                  : 'Distractor option.'),
            }));
            return {
              question_id: item.question_id,
              question_number: 0,
              text: item.question_text || item.text || '',
              options: optionsList,
              section_code: item.subject_name || querySubject || 'Recommended',
              subject: item.subject_name || querySubject || gSubject || 'General Studies',
              topic_name: item.topic_name || queryTopic,
              subtopic_name: item.subtopic_name,
              difficulty: item.difficulty || 'MEDIUM',
              marks: item.marks || 2.0,
              negative_marks: item.negative_marks || 0.66,
              expected_time_seconds: item.expected_time_seconds || 60,
              source_year: item.source_year || item.exam_year || gYear,
              exam_name: item.exam_name || gExam || 'UPSC CSE',
            } as any;
          });

          setRecommendedPool((prev) => {
            let newList = [...prev];
            const existingIds = new Set(prev.map((q) => q.question_id));

            for (let i = formatted.length - 1; i >= 0; i--) {
              const q = formatted[i];
              if (!existingIds.has(q.question_id)) {
                newList.unshift(q);
              }
            }

            while (newList.length > 15) {
              let evictIdx = -1;
              const currentExpanded = expandedRecIdRef.current;
              const currentResponses = recUserResponsesRef.current;

              // Prefer removing already-answered questions that are not expanded
              for (let i = newList.length - 1; i >= 0; i--) {
                const q = newList[i];
                if (q.question_id !== currentExpanded && currentResponses[q.question_id]) {
                  evictIdx = i;
                  break;
                }
              }

              // If none found, just find the oldest not expanded
              if (evictIdx === -1) {
                for (let i = newList.length - 1; i >= 0; i--) {
                  if (newList[i].question_id !== currentExpanded) {
                    evictIdx = i;
                    break;
                  }
                }
              }

              if (evictIdx !== -1) {
                newList.splice(evictIdx, 1);
              } else {
                newList.pop();
              }
            }

            return newList;
          });
        }
      } catch (err) {
        console.warn('Background recommendation prefetch error:', err);
        setIsRecsExhausted(true);
      } finally {
        setIsPrefetchingRecs(false);
      }
    },
    [gSubject, gTopic, gExam, userResponses, revealedMap, isPrefetchingRecs, isRecsExhausted],
  );

  // Fires on mount (allQuestions is still [] at that point) so the
  // recommendations fetch starts in parallel with the main question load
  // instead of waiting for it to finish first — it only needs gSubject/
  // gTopic/gExam (already known from the URL) to build its query, and an
  // empty allQuestions/recommendedPool just means nothing to exclude yet.
  useEffect(() => {
    if (recommendedPool.length < 15 && !isPrefetchingRecs && !isRecsExhausted) {
      prefetchRecommendations(allQuestions, recommendedPool);
    }
  }, [
    allQuestions,
    recommendedPool.length,
    isPrefetchingRecs,
    isRecsExhausted,
    prefetchRecommendations,
  ]);

  // Handler to toggle recommended question accordion (NEVER touches the center card)
  const handleSelectRecommendation = (recQ: QuestionOut) => {
    userToggledRecRef.current = true;
    setExpandedRecId((prev) => (prev === recQ.question_id ? null : recQ.question_id));
  };

  // Keep the first recommended question expanded until the user manually
  // expands/collapses a card themselves — recommendedPool can reorder or evict
  // items as it prefetches, so a one-shot "expand index 0 once" can end up
  // pointing at a question_id that's no longer in the list.
  useEffect(() => {
    if (!userToggledRecRef.current) {
      setExpandedRecId(recommendedPool[0]?.question_id ?? null);
    }
  }, [recommendedPool]);

  // Handler to load a recommended question into the main exam flow (used by onNext when pool exhausted)
  const handleLoadRecommendedIntoExam = (recQ: QuestionOut) => {
    const existingIdx = allQuestions.findIndex((q) => q.question_id === recQ.question_id);
    if (existingIdx !== -1) {
      handleSelectQuestion(existingIdx);
      return;
    }
    // Append to allQuestions and navigate to it
    setAllQuestions((prev) => {
      const next = [...prev, recQ];
      setTotalQuestions(next.length);
      setCurrentQIndex(next.length - 1);
      setActiveQuestion(recQ);
      return next;
    });
    // Remove from recommended pool since it's now a main question
    setRecommendedPool((prev) => prev.filter((q) => q.question_id !== recQ.question_id));
  };

  // Fetches the full comprehensive solution for a recommended question (once per question)
  const fetchRecommendationSolution = async (qId: number | string) => {
    if (recSolutions[qId] || recSolutionLoading[qId]) return;
    setRecSolutionLoading((prev) => ({ ...prev, [qId]: true }));
    try {
      const res = await fetch(`/api/v1/questions/${qId}/solution`);
      if (res.ok) {
        const data = await res.json();
        setRecSolutions((prev) => ({ ...prev, [qId]: data }));
      }
    } catch (err) {
      console.warn('Rec solution fetch error:', err);
    } finally {
      setRecSolutionLoading((prev) => ({ ...prev, [qId]: false }));
    }
  };

  // Records the user's answer for a recommended question and kicks off its solution fetch
  const handleSelectRecommendationOption = (rec: QuestionOut, optionId: number | string) => {
    setRecUserResponses((prev) => ({ ...prev, [rec.question_id]: optionId }));
    fetchRecommendationSolution(rec.question_id);
  };

  const displayRecs = recommendedPool;

  // Subject-Wide Fallback Pool & Topic Completion Banner
  const [subjectFallbackPool, setSubjectFallbackPool] = useState<QuestionOut[]>([]);
  const [isPrefetchingSubjectFallback, setIsPrefetchingSubjectFallback] = useState(false);
  const [hasFetchedSubjectFallback, setHasFetchedSubjectFallback] = useState(false);
  const [topicCompletionBanner, setTopicCompletionBanner] = useState<string | null>(null);

  // Auto-prefetch broader subject questions immediately if topic questions count <= 3, or when getting close to end (2 questions left)
  useEffect(() => {
    const isNearEnd = currentQIndex >= allQuestions.length - 2;
    const hasSmallQuestionCount = allQuestions.length <= 3;

    if (
      gTopic &&
      gTopic !== 'All Topics' &&
      allQuestions.length > 0 &&
      (hasSmallQuestionCount || isNearEnd) &&
      !hasFetchedSubjectFallback &&
      !isPrefetchingSubjectFallback
    ) {
      const fetchSubjectFallback = async () => {
        setIsPrefetchingSubjectFallback(true);
        try {
          const existingIds = new Set<string | number>();
          allQuestions.forEach((q) => {
            if (q.question_id) existingIds.add(q.question_id);
          });
          recommendedPool.forEach((q) => {
            if (q.question_id) existingIds.add(q.question_id);
          });
          subjectFallbackPool.forEach((q) => {
            if (q.question_id) existingIds.add(q.question_id);
          });
          Object.keys(userResponses).forEach((qId) => existingIds.add(qId));
          Object.keys(revealedMap).forEach((qId) => existingIds.add(qId));

          const excludeIdsParam = Array.from(existingIds).join(',');
          const rawSubject =
            gSubject && !gSubject.startsWith('All Subjects') ? gSubject.trim() : '';
          const targetExam = gExam
            ? gExam.toLowerCase().includes('upsc')
              ? 'upsc'
              : gExam.toLowerCase().trim()
            : '';

          const params = new URLSearchParams({ limit: '15', include_solutions: 'true' });
          if (rawSubject) params.append('subject_name', rawSubject);
          if (targetExam) params.append('exam_name', targetExam);
          if (excludeIdsParam) params.append('exclude_ids', excludeIdsParam);

          const res = await fetch(`/api/v1/questions?${params.toString()}`);
          if (res.ok) {
            const data = await res.json();
            const items = (data.items || []).filter(
              (item: any) => !existingIds.has(item.question_id),
            );
            if (items.length > 0) {
              const formatted: QuestionOut[] = items.map((item: any, idx: number) => {
                const rawOptions = item.options || [];
                const optionsList = rawOptions.map((o: any, oIdx: number) => ({
                  option_id:
                    o.option_id ||
                    `opt-sub-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
                  option_label: o.option_label || String.fromCharCode(65 + oIdx),
                  text:
                    o.option_text ||
                    o.text ||
                    `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
                  is_correct: Boolean(o.is_correct),
                }));
                return {
                  question_id: item.question_id,
                  question_number: 0,
                  text: item.question_text || item.text || '',
                  options: optionsList,
                  section_code:
                    item.topic_name || item.subject_name || rawSubject || 'Subject Practice',
                  topic_name: item.topic_name || 'Subject Practice',
                  subtopic_name: item.subtopic_name,
                  difficulty: item.difficulty || 'MEDIUM',
                  marks: item.marks || 2.0,
                  negative_marks: item.negative_marks || 0.66,
                  expected_time_seconds: item.expected_time_seconds || 60,
                  explanation: item.explanation || item.explanation_text || '',
                } as any;
              });

              setSubjectFallbackPool(formatted);
            }
          }
        } catch (err) {
          console.warn('Subject fallback prefetch error:', err);
        } finally {
          setHasFetchedSubjectFallback(true);
          setIsPrefetchingSubjectFallback(false);
        }
      };

      fetchSubjectFallback();
    }
  }, [
    gTopic,
    gSubject,
    gExam,
    allQuestions,
    currentQIndex,
    hasFetchedSubjectFallback,
    isPrefetchingSubjectFallback,
    recommendedPool,
    subjectFallbackPool,
    userResponses,
    revealedMap,
  ]);

  // Handler to append prefetched subject fallback questions when topic questions finish
  const handleLoadSubjectFallbackQuestions = useCallback(() => {
    if (subjectFallbackPool.length === 0) return false;

    const startNum = allQuestions.length;
    const newQuestions = subjectFallbackPool.map((q, idx) => ({
      ...q,
      question_number: startNum + idx + 1,
    }));

    const updatedQuestions = [...allQuestions, ...newQuestions];
    const newPaletteItems: QuestionPaletteItem[] = newQuestions.map((q) => ({
      question_number: q.question_number,
      question_id: q.question_id,
      question_status: 'NOT_VISITED' as any,
    }));

    setAllQuestions(updatedQuestions);
    setTotalQuestions(updatedQuestions.length);
    setPalette((prev) => [...prev, ...newPaletteItems]);

    // Show popup notification banner
    setTopicCompletionBanner(
      `Questions finished for "${gTopic}"! Now loading similar questions from ${gSubject || 'this subject'}.`,
    );

    // Clear subject fallback pool after appending
    setSubjectFallbackPool([]);
    return true;
  }, [allQuestions, subjectFallbackPool, gTopic, gSubject]);

  // Mobile Responsiveness
  const { isTabletOrBelow } = useBreakpoint();
  const [showMobileRecs, setShowMobileRecs] = useState(false);

  const SESSION_KEY = `student_practice_session_${gExam}_${gYear}_${gSubject}_${gTopic}_${gSubtopic}_${gCount}`;

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle 10-second countdown after completing all questions
  useEffect(() => {
    if (scoreCountdown === null) return;
    if (scoreCountdown <= 0) {
      setScoreCountdown(null);
      setShowScoreModal(true);
      return;
    }
    const cdTimer = setInterval(() => {
      setScoreCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(cdTimer);
  }, [scoreCountdown]);

  // Clean option labels helper
  const cleanOptionLabel = (label: string, idx: number): string => {
    if (label && label.length <= 2) return label.toUpperCase();
    const map = ['A', 'B', 'C', 'D', 'E'];
    return map[idx] || `OPT${idx + 1}`;
  };

  // Load Real Practice Questions from Database using Live Syllabus APIs
  useEffect(() => {
    async function loadPracticeQuestions() {
      setIsLoading(true);
      const fetchedMap = new Map<string, any>();

      // 1. Fetch Master Syllabus Tree & Published Exams from API
      try {
        const [sData, eList] = await Promise.all([
          fetchMasterSyllabus().catch(() => null),
          listExams('PUBLISHED').catch(() => []),
        ]);
        if (sData) setMasterSyllabus(sData);
        if (eList && eList.length > 0) {
          const names = Array.from(
            new Set(eList.map((e: any) => e.title || e.exam_name || e.code).filter(Boolean)),
          );
          if (names.length > 0) setAvailableExams(names);
        }
      } catch (err) {
        console.warn('Practice exam taxonomy API warning:', err);
      }

      const formatQuestion = (q: any, idx: number): QuestionOut => {
        const rawOpts = q.options || [];
        const optionsList = rawOpts.map((o: any, oIdx: number) => ({
          option_id: o.option_id || `opt-${idx}-${oIdx}`,
          option_label: cleanOptionLabel(o.option_label || '', oIdx),
          text: o.option_text || o.text || `Option ${o.option_label || oIdx + 1}`,
          is_correct: Boolean(o.is_correct),
          distractor_analysis: o.distractor_analysis || null,
        }));

        const expObj = q.explanation;
        let expText = '';
        if (typeof expObj === 'object' && expObj !== null) {
          expText = expObj.detailed_solution || expObj.solution || expObj.text || '';
        } else if (typeof expObj === 'string') {
          expText = expObj;
        }

        const primaryH =
          (q.hierarchy || []).find((h: any) => h.is_primary) || (q.hierarchy || [])[0] || {};
        const subjName =
          primaryH.subject_name ||
          q.subject_name ||
          (gSubject && !gSubject.startsWith('All Subjects') ? gSubject : 'General Studies');
        const topName =
          primaryH.topic_name ||
          q.topic_name ||
          (gTopic && !gTopic.startsWith('All Topics') ? gTopic : subjName);
        const subtopName =
          primaryH.subtopic_name ||
          q.subtopic_name ||
          (gSubtopic && !gSubtopic.startsWith('All Subtopics') ? gSubtopic : '');

        return {
          question_id: q.question_id || `q-practice-${idx + 1}`,
          question_number: idx + 1,
          text: q.question_text || q.text || '',
          passage_text: q.passage_text || null,
          options: optionsList,
          section_code: topName || subjName || 'General Studies',
          subject_name: subjName,
          topic_name: topName,
          subtopic_name: subtopName,
          concept_name: primaryH.concept_name || '',
          exam_name: q.exam_name || (gExam && !gExam.startsWith('All Exams') ? gExam : 'UPSC CSE'),
          source_year:
            q.source_year ||
            (gYear && gYear.replace(/\D/g, '') ? Number(gYear.replace(/\D/g, '')) : 2023),
          stage: q.stage || 'Prelims',
          paper_set_code: q.paper_set_code || 'SET_A',
          difficulty: q.difficulty || 'MEDIUM',
          marks: q.marks || 2.0,
          negative_marks: q.negative_marks || 0.66,
          expected_time_seconds: q.expected_time_seconds || 60,
          explanation: expObj || expText,
        } as any;
      };

      const rawSubject = gSubject !== 'All Subjects' ? gSubject.trim() : '';
      let reqSubject = rawSubject;
      let reqTopic = gTopic && !gTopic.startsWith('All Topics') ? gTopic.trim() : '';

      try {
        const verified = await verifySyllabusNode({
          subject: reqSubject,
          topic: reqTopic,
        });
        if (verified && verified.is_valid) {
          if (verified.resolved_node?.subject) reqSubject = verified.resolved_node.subject;
          if (verified.resolved_node?.topic) reqTopic = verified.resolved_node.topic;
        }
      } catch (err) {
        console.warn('Practice exam verifySyllabusNode warning:', err);
      }

      // Extract numeric exam year if the user picked a specific year — the
      // default "All Years (min - max)" placeholder must NOT be parsed here,
      // since its leftmost year token (the range's min) would otherwise be
      // misread as an exact year filter and needlessly fail the first fetch.
      let numericYear: string | null = null;
      if (gYear && !gYear.startsWith('All Years')) {
        const match = gYear.match(/\b(19\d\d|20\d\d)\b/);
        if (match) numericYear = match[1];
      }

      const fetchWithParams = async (params: URLSearchParams) => {
        try {
          if (!params.has('include_solutions')) {
            params.append('include_solutions', 'true');
          }
          const res = await fetch(`/api/v1/questions?${params.toString()}`);
          if (res.ok) {
            const data = await res.json();
            (data.items || []).forEach((item: any) => {
              if (item.question_id && !fetchedMap.has(item.question_id)) {
                fetchedMap.set(item.question_id, item);
              }
            });
          }
        } catch (err) {
          console.warn('Practice questions fetch error:', err);
        }
      };

      try {
        const targetExam = gExam
          ? gExam.toLowerCase().includes('upsc')
            ? 'upsc'
            : gExam.toLowerCase().trim()
          : '';

        // Fetch enough for a comfortable session (3x what was requested,
        // floor 20) instead of always asking for the API's max of 100 — the
        // subject-fallback/expansion effects already top this up later if the
        // user runs low, so there's no need to pull (and have the backend
        // fully build detail cards for) far more than a session needs up front.
        const initialFetchLimit = Math.min(100, Math.max(gCount * 3, 20));

        // 1. Try with subject + topic + year + selected exam
        const p1 = new URLSearchParams({ limit: String(initialFetchLimit) });
        if (reqSubject) p1.append('subject_name', reqSubject);
        if (reqTopic) p1.append('topic_name', reqTopic);
        if (numericYear) p1.append('exam_year', numericYear);
        if (targetExam) p1.append('exam_name', targetExam);

        await fetchWithParams(p1);

        // 2. Fallback: Relax year if 0 questions found for exact year (keep subject + topic)
        if (fetchedMap.size === 0 && reqTopic) {
          const p2 = new URLSearchParams({ limit: String(initialFetchLimit) });
          if (reqSubject) p2.append('subject_name', reqSubject);
          p2.append('topic_name', reqTopic);
          if (targetExam) p2.append('exam_name', targetExam);
          await fetchWithParams(p2);
        }

        // 3. Fallback: Relax topic to subject if still 0 questions found (keep subject)
        if (fetchedMap.size === 0 && reqSubject) {
          const p3 = new URLSearchParams({ limit: String(initialFetchLimit) });
          p3.append('subject_name', reqSubject);
          if (targetExam) p3.append('exam_name', targetExam);
          await fetchWithParams(p3);
        }

        // 4. Fallback: Try raw subject if canonical subject differed (keep subject)
        if (fetchedMap.size === 0 && rawSubject && rawSubject !== reqSubject) {
          const p4 = new URLSearchParams({ limit: String(initialFetchLimit) });
          p4.append('subject_name', rawSubject);
          if (targetExam) p4.append('exam_name', targetExam);
          await fetchWithParams(p4);
        }

        // 5. Fallback: Relax exam filter but strictly keep subject_name if user selected a subject
        if (fetchedMap.size === 0 && (reqSubject || rawSubject)) {
          const p5 = new URLSearchParams({ limit: String(initialFetchLimit) });
          p5.append('subject_name', reqSubject || rawSubject);
          await fetchWithParams(p5);
        }

        // 6. Fallback: Only if user explicitly chose "All Subjects" (no subject selected)
        if (fetchedMap.size === 0 && !rawSubject) {
          const p6 = new URLSearchParams({ limit: String(initialFetchLimit) });
          if (targetExam) p6.append('exam_name', targetExam);
          await fetchWithParams(p6);
        }
      } catch (err) {
        console.warn('Practice questions fetch warning:', err);
      }

      let fetchedList = Array.from(fetchedMap.values());
      const questionsList: QuestionOut[] = fetchedList.map((item, idx) =>
        formatQuestion(item, idx),
      );

      setAllQuestions(questionsList);
      setTotalQuestions(questionsList.length);
      setActiveQuestion(questionsList.length > 0 ? questionsList[0] : null);

      // Restore session state from sessionStorage
      let restoredResponses: Record<string, any> = {};
      let restoredRevealed: Record<string, any> = {};
      let restoredMarked: Record<string, boolean> = {};

      if (questionsList.length > 0) {
        try {
          const savedRaw = sessionStorage.getItem(SESSION_KEY);
          if (savedRaw) {
            const savedData = JSON.parse(savedRaw);
            if (savedData.userResponses) {
              restoredResponses = savedData.userResponses;
              setUserResponses(savedData.userResponses);
            }
            if (savedData.revealedMap) {
              restoredRevealed = savedData.revealedMap;
              setRevealedMap(savedData.revealedMap);
            }
            if (savedData.markedForReview) {
              restoredMarked = savedData.markedForReview;
              setMarkedForReview(savedData.markedForReview);
            }
            if (savedData.bookmarkedQs) setBookmarkedQs(savedData.bookmarkedQs);
            if (typeof savedData.timeLeft === 'number' && savedData.timeLeft > 0) {
              setTimeLeft(savedData.timeLeft);
            }
            if (
              typeof savedData.currentQIndex === 'number' &&
              savedData.currentQIndex >= 0 &&
              savedData.currentQIndex < questionsList.length
            ) {
              setCurrentQIndex(savedData.currentQIndex);
              setActiveQuestion(questionsList[savedData.currentQIndex]);
            }
          }
        } catch (err) {
          console.warn('Failed to restore student practice sessionStorage:', err);
        }

        const initialPalette: QuestionPaletteItem[] = questionsList.map((q, i) => {
          const qId = q.question_id;
          const isRevealed = !!restoredRevealed[qId];
          const isMarked = !!restoredMarked[qId];
          let status: any = i === 0 ? 'VISITED' : 'UNVISITED';
          if (isRevealed) {
            status = isMarked ? 'ANSWERED_AND_MARKED' : 'ANSWERED';
          } else if (isMarked) {
            status = 'MARKED_FOR_REVIEW';
          }
          return {
            question_number: i + 1,
            question_id: qId,
            question_status: status,
          };
        });
        setPalette(initialPalette);
      } else {
        setPalette([]);
      }

      setIsLoading(false);
    }

    loadPracticeQuestions();
  }, [gExam, gYear, gSubject, gTopic, gSubtopic, gCount]);

  // Persist session state to sessionStorage
  useEffect(() => {
    if (isLoading || allQuestions.length === 0) return;
    try {
      const payload = {
        userResponses,
        revealedMap,
        markedForReview,
        bookmarkedQs,
        currentQIndex,
        timeLeft,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write student practice sessionStorage:', err);
    }
  }, [
    userResponses,
    revealedMap,
    markedForReview,
    bookmarkedQs,
    currentQIndex,
    timeLeft,
    isLoading,
    allQuestions,
  ]);

  // Switch Question
  const handleSelectQuestion = (idx: number) => {
    if (idx < 0 || idx >= allQuestions.length) return;
    setCurrentQIndex(idx);
    setActiveQuestion(allQuestions[idx]);

    setPalette((prev) =>
      prev.map((item, i) => {
        if (i === idx) {
          if (item.question_status === 'UNVISITED') {
            return { ...item, question_status: 'VISITED' };
          }
        }
        return item;
      }),
    );
  };

  // Option selection
  const handleToggleBookmark = async () => {
    if (!activeQuestion) return;
    const qId = String(activeQuestion.question_id || (activeQuestion as any).id);
    const isBookmarked = !!bookmarkedQs[currentQIndex];

    // Optimistic UI update
    setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !isBookmarked }));

    try {
      if (isBookmarked) {
        await removeBookmark(qId);
      } else {
        await addBookmark(qId);
      }
    } catch (error) {
      console.error('Failed to toggle bookmark', error);
      // Revert on failure
      setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: isBookmarked }));
    }
  };

  const handleSelectOption = (optionId: number | string, optionLabel: string) => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;
    if (revealedMap[qId]) return; // Locked once submitted

    setUserResponses((prev) => ({
      ...prev,
      [qId]: { optionId, optionLabel },
    }));
  };

  // Helper to expand subject questions when current topic questions are finished
  const checkAndExpandSubjectQuestions = useCallback(async (): Promise<boolean> => {
    if (subjectFallbackPool.length > 0) {
      return handleLoadSubjectFallbackQuestions();
    }

    if (gTopic && gTopic !== 'All Topics') {
      try {
        const existingIds = new Set<string | number>();
        allQuestions.forEach((q) => {
          if (q.question_id) existingIds.add(q.question_id);
        });
        recommendedPool.forEach((q) => {
          if (q.question_id) existingIds.add(q.question_id);
        });
        Object.keys(userResponses).forEach((qId) => existingIds.add(qId));
        Object.keys(revealedMap).forEach((qId) => existingIds.add(qId));

        const excludeIdsParam = Array.from(existingIds).join(',');
        const rawSubject = gSubject && !gSubject.startsWith('All Subjects') ? gSubject.trim() : '';
        const targetExam = gExam
          ? gExam.toLowerCase().includes('upsc')
            ? 'upsc'
            : gExam.toLowerCase().trim()
          : '';

        const params = new URLSearchParams({ limit: '15', include_solutions: 'true' });
        if (rawSubject) params.append('subject_name', rawSubject);
        if (targetExam) params.append('exam_name', targetExam);
        if (excludeIdsParam) params.append('exclude_ids', excludeIdsParam);

        const res = await fetch(`/api/v1/questions?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.items || []).filter(
            (item: any) => !existingIds.has(item.question_id),
          );
          if (items.length > 0) {
            const formatted: QuestionOut[] = items.map((item: any, idx: number) => {
              const rawOptions = item.options || [];
              const optionsList = rawOptions.map((o: any, oIdx: number) => ({
                option_id:
                  o.option_id ||
                  `opt-sub-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
                option_label: o.option_label || String.fromCharCode(65 + oIdx),
                text:
                  o.option_text ||
                  o.text ||
                  `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
                is_correct: Boolean(o.is_correct),
              }));
              return {
                question_id: item.question_id,
                question_number: 0,
                text: item.question_text || item.text || '',
                options: optionsList,
                section_code:
                  item.topic_name || item.subject_name || rawSubject || 'Subject Practice',
                topic_name: item.topic_name || 'Subject Practice',
                subtopic_name: item.subtopic_name,
                difficulty: item.difficulty || 'MEDIUM',
                marks: item.marks || 2.0,
                negative_marks: item.negative_marks || 0.66,
                expected_time_seconds: item.expected_time_seconds || 60,
                explanation: item.explanation || item.explanation_text || '',
              } as any;
            });

            const startNum = allQuestions.length;
            const newQuestions = formatted.map((q, idx) => ({
              ...q,
              question_number: startNum + idx + 1,
            }));

            const updatedQuestions = [...allQuestions, ...newQuestions];
            const newPaletteItems: QuestionPaletteItem[] = newQuestions.map((q) => ({
              question_number: q.question_number,
              question_id: q.question_id,
              question_status: 'NOT_VISITED' as any,
            }));

            setAllQuestions(updatedQuestions);
            setTotalQuestions(updatedQuestions.length);
            setPalette((prev) => [...prev, ...newPaletteItems]);

            setTopicCompletionBanner(
              `Questions finished for "${gTopic}"! Now loading similar questions from ${gSubject || 'this subject'}.`,
            );
            return true;
          }
        }
      } catch (err) {
        console.warn('Direct subject expansion fetch warning:', err);
      }
    }

    return false;
  }, [
    allQuestions,
    subjectFallbackPool,
    handleLoadSubjectFallbackQuestions,
    gTopic,
    gSubject,
    gExam,
    userResponses,
    revealedMap,
  ]);

  // Reveal Instant Per-Question Answer & Description with Full Solution
  const handleRevealAnswer = async (
    qId?: number | string,
    overrideOptId?: number | string,
    overrideOptLbl?: string,
  ) => {
    const targetId = qId || activeQuestion?.question_id;
    if (!targetId) return;

    const targetQuestion = allQuestions.find((q) => q.question_id === targetId) || activeQuestion;
    if (!targetQuestion) return;

    let userResp = overrideOptId
      ? { optionId: overrideOptId, optionLabel: overrideOptLbl || '' }
      : userResponses[targetId];
    if (!userResp) return;

    const correctOpt = targetQuestion.options?.find((o) => o.is_correct);

    let isUserCorrect = false;
    if (userResp && targetQuestion.options) {
      const selectedOpt = targetQuestion.options.find(
        (o, idx) =>
          o.option_id === userResp!.optionId ||
          cleanOptionLabel(o.option_label || '', idx) === userResp!.optionLabel,
      );
      if (selectedOpt && selectedOpt.is_correct) {
        isUserCorrect = true;
      }
    }

    const correctOptIndex = targetQuestion.options?.findIndex((o) => o.is_correct) ?? 0;
    const correctLabel = correctOpt
      ? cleanOptionLabel(correctOpt.option_label || '', correctOptIndex)
      : 'A';

    const expContent =
      (targetQuestion as any).explanation?.detailed_solution ||
      (targetQuestion as any).explanation ||
      (targetQuestion as any).description ||
      (targetQuestion as any).solution ||
      (targetQuestion as any).solution_text ||
      `Option (${correctLabel}) is correct.`;

    const distractorScores: Record<string, any> = {};
    if (Array.isArray(targetQuestion.options)) {
      targetQuestion.options.forEach((opt: any) => {
        const oId = String(opt.option_id);
        distractorScores[oId] = {
          option_id: oId,
          label: opt.option_label,
          is_correct: opt.is_correct,
          closeness_score: opt.closeness_score ?? 0,
          analysis: opt.distractor_analysis || '',
        };
      });
    }

    const revealObj: RevealAnswerResponse = {
      question_id: targetId,
      question_number: targetQuestion.question_number,
      correct_option_id: correctOpt?.option_id || '',
      correct_option_label: correctLabel,
      is_user_correct: isUserCorrect,
      user_selected_option_id: userResp?.optionId || null,
      user_selected_label: userResp?.optionLabel || null,
      marks_awarded: isUserCorrect
        ? targetQuestion.marks || 2.0
        : -(targetQuestion.negative_marks || 0.66),
      closeness_score: isUserCorrect ? 100 : 0,
      closeness_classification: isUserCorrect ? 'EXACT' : 'INCORRECT',
      explanation: expContent,
      distractor_scores: distractorScores,
    };

    const updatedRevealedMap = {
      ...revealedMap,
      [targetId]: revealObj,
    };

    setRevealedMap(updatedRevealedMap);

    setPalette((prev) =>
      prev.map((item) => {
        if (item.question_id === targetId) {
          const isMarked = markedForReview[targetId];
          return {
            ...item,
            question_status: isMarked ? ('ANSWERED_AND_MARKED' as any) : ('ANSWERED' as any),
          };
        }
        return item;
      }),
    );

    // Check if ALL currently loaded questions are finished (revealed)
    const numQuestions = allQuestions.length;
    if (Object.keys(updatedRevealedMap).length >= numQuestions && numQuestions > 0) {
      const expanded = await checkAndExpandSubjectQuestions();
      if (!expanded) {
        handleFinishPracticeExam(updatedRevealedMap);
      }
    }
  };

  const handleShowSolution = async (passedRevealedMap?: Record<string, RevealAnswerResponse>) => {
    const targetId = activeQuestion?.question_id;
    if (targetId) {
      const existingRevealed = (passedRevealedMap && passedRevealedMap[targetId]) || revealedMap[targetId];
      const hasExplanation = existingRevealed?.explanation && (
        typeof existingRevealed.explanation === 'string'
          ? existingRevealed.explanation.trim().length > 0
          : Object.keys(existingRevealed.explanation).length > 0
      );
      const hasDistractors = existingRevealed?.distractor_scores && Object.keys(existingRevealed.distractor_scores).length > 0;

      if (!hasExplanation || !hasDistractors) {
        if ((activeQuestion as any)?.explanation || (activeQuestion?.options && activeQuestion.options.length > 0)) {
          const distractorScores: Record<string, any> = { ...(existingRevealed?.distractor_scores || {}) };
          if (Array.isArray(activeQuestion.options)) {
            activeQuestion.options.forEach((opt: any) => {
              const oId = String(opt.option_id);
              if (!distractorScores[oId]) {
                distractorScores[oId] = {
                  option_id: oId,
                  label: opt.option_label,
                  is_correct: opt.is_correct,
                  closeness_score: opt.closeness_score ?? 0,
                  analysis: opt.distractor_analysis || '',
                };
              }
            });
          }
          const exp = (activeQuestion as any).explanation?.detailed_solution || (activeQuestion as any).explanation || existingRevealed?.explanation;
          setRevealedMap((prev) => {
            const current = prev[targetId] || {};
            return {
              ...prev,
              [targetId]: {
                ...current,
                explanation: exp || current.explanation,
                distractor_scores: Object.keys(distractorScores).length > 0 ? distractorScores : current.distractor_scores,
              }
            };
          });
          return;
        }

        setIsSolutionLoading(true);
        try {
          const solRes = await fetch(`/api/v1/questions/${targetId}/solution`);
          if (solRes.ok) {
            const solPayload = await solRes.json();
            setRevealedMap((prev) => {
              const current = prev[targetId] || {};
              return {
                ...prev,
                [targetId]: {
                  ...current,
                  correct_option_id: solPayload.correct_option_id || current.correct_option_id,
                  correct_option_label:
                    solPayload.correct_option_label || current.correct_option_label,
                  explanation: solPayload.explanation || current.explanation,
                  distractor_scores: solPayload.distractor_scores || current.distractor_scores,
                  presigned_url: solPayload.presigned_url || (current as any).presigned_url,
                },
              };
            });
          }
        } catch (err) {
          console.warn('Lazy solution fetch error:', err);
        } finally {
          setIsSolutionLoading(false);
        }
      }
    }

    const rMap = passedRevealedMap || revealedMap;
    const numQuestions = allQuestions.length;
    const isCompleted = Object.keys(rMap).length >= numQuestions && numQuestions > 0;
    if (isCompleted && scoreCountdown === null && !showScoreModal) {
      const expanded = await checkAndExpandSubjectQuestions();
      if (!expanded) {
        handleFinishPracticeExam(rMap);
      }
    }
  };

  const handleFinishPracticeExam = (passedRevealedMap?: Record<string, RevealAnswerResponse>) => {
    const rMap = passedRevealedMap || revealedMap;
    const numQuestions = allQuestions.length;
    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;

    const cleanOptionLabel = (rawLabel: string, index: number): string => {
      if (!rawLabel) return String.fromCharCode(65 + index);
      const clean = String(rawLabel)
        .replace(/[\(\)\.\s]/g, '')
        .toUpperCase();
      return clean.length === 1 ? clean : String.fromCharCode(65 + index);
    };

    const responsesPayload = allQuestions.map((q, idx) => {
      const userResp = userResponses[q.question_id];
      const rev = rMap[q.question_id];
      let isCorr = false;

      if (rev) {
        isCorr = Boolean(rev.is_user_correct);
      } else if (userResp && q.options) {
        const selectedOpt = q.options.find(
          (o, oIdx) =>
            o.option_id === userResp.optionId ||
            cleanOptionLabel(o.option_label || '', oIdx) === userResp.optionLabel,
        );
        if (selectedOpt && selectedOpt.is_correct) {
          isCorr = true;
        }
      }

      if (userResp || rev) {
        attemptedCount += 1;
        if (isCorr) {
          correctCount += 1;
        } else {
          incorrectCount += 1;
        }
      }

      return {
        question_id: q.question_id,
        selected_option_id: userResp?.optionId || rev?.user_selected_option_id || null,
        is_correct: isCorr,
        time_taken_seconds: 60.0,
        expected_time_seconds: q.expected_time_seconds || 60.0,
        is_switched: false,
      };
    });

    const totalMarksPossible = numQuestions;
    const unattemptedCount = Math.max(0, numQuestions - attemptedCount);
    const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

    const scorePayload = {
      score: correctCount,
      totalMarksPossible,
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracy,
      totalQuestions: numQuestions,
      topicName: gTopic,
      subtopicName: gSubtopic,
      targetExam: gExam,
      targetYear: gYear,
      timeSpentSeconds: Math.max(30, 600 - timeLeft),
      responses: responsesPayload,
    };

    const savedAttempt = saveGuestAttempt(scorePayload);
    setGuestScoreData({ ...scorePayload, attemptId: savedAttempt.id });
    setScoreCountdown(null);
    setShowScoreModal(true);
  };

  // Clear Response
  const handleClearResponse = () => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;

    setUserResponses((prev) => {
      const updated = { ...prev };
      delete updated[qId];
      return updated;
    });

    setPalette((prev) =>
      prev.map((item) => {
        if (item.question_id === qId) {
          const isMarked = markedForReview[qId];
          return {
            ...item,
            question_status: isMarked ? ('MARKED_FOR_REVIEW' as any) : ('VISITED' as any),
          };
        }
        return item;
      }),
    );
  };

  // Toggle Mark for Review
  const handleToggleMarkReview = () => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;
    const nextMarked = !markedForReview[qId];

    setMarkedForReview((prev) => ({
      ...prev,
      [qId]: nextMarked,
    }));

    setPalette((prev) =>
      prev.map((item) => {
        if (item.question_id === qId) {
          const isSubmitted = !!revealedMap[qId];
          if (nextMarked) {
            return {
              ...item,
              question_status: isSubmitted
                ? ('ANSWERED_AND_MARKED' as any)
                : ('MARKED_FOR_REVIEW' as any),
            };
          }
          return {
            ...item,
            question_status: isSubmitted ? ('ANSWERED' as any) : ('VISITED' as any),
          };
        }
        return item;
      }),
    );
  };

  // Dynamically extract subjects from API masterSyllabus tree and fetched questions.
  // The syllabus API returns subjects as an array (each with its own nested
  // `topics`), not a flat dict keyed by subject name — this used to do
  // Object.keys(masterSyllabus) directly, which only ever returned the
  // response's top-level field names (title, total_subjects, subjects, ...),
  // never actual subject names, so this list silently never matched what the
  // Instant Practice Test Generator (MockSelectionPage) shows.
  const syllabusSubjectsArr: any[] =
    masterSyllabus?.subjects && Array.isArray(masterSyllabus.subjects)
      ? masterSyllabus.subjects
      : [];
  const syllabusSubjects = syllabusSubjectsArr.map((s: any) => s.name).filter(Boolean);
  const questionSubjects = Array.from(
    new Set(allQuestions.map((q) => q.section_code || (q as any).subject_name).filter(Boolean)),
  );
  const combinedSubjects = Array.from(new Set([...syllabusSubjects, ...questionSubjects]));
  const subjectsList = ['All Subjects', ...combinedSubjects];

  // Dynamically extract topics from API masterSyllabus tree and fetched questions
  let dynamicTopics: string[] = [];
  if (gSubject && gSubject !== 'All Subjects') {
    const matchedSubject = syllabusSubjectsArr.find((s: any) => s.name === gSubject);
    if (matchedSubject && Array.isArray(matchedSubject.topics)) {
      dynamicTopics = matchedSubject.topics.map((t: any) => t.name).filter(Boolean);
    }
  } else {
    syllabusSubjectsArr.forEach((s: any) => {
      if (Array.isArray(s.topics)) {
        dynamicTopics.push(...s.topics.map((t: any) => t.name).filter(Boolean));
      }
    });
  }
  const qTopics = allQuestions.map((q) => q.topic_name).filter(Boolean) as string[];
  dynamicTopics = Array.from(new Set([...dynamicTopics, ...qTopics]));
  const availableTopics = ['All Topics', ...dynamicTopics];

  const selectedOptionsMap: Record<number, number | string> = {};
  const markedForReviewMap: Record<number, boolean> = {};

  allQuestions.forEach((q, idx) => {
    if (userResponses[q.question_id]) {
      selectedOptionsMap[idx] = userResponses[q.question_id].optionId;
    }
    if (markedForReview[q.question_id]) {
      markedForReviewMap[idx] = true;
    }
  });

  const answeredCount = Object.keys(userResponses).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = Math.max(0, totalQuestions - answeredCount);

  const currentResponse = activeQuestion ? userResponses[activeQuestion.question_id] : null;
  const currentRevealedResult = activeQuestion ? revealedMap[activeQuestion.question_id] : null;

  const isCurrentAnswered = !!currentResponse;
  const isCurrentMarked = activeQuestion ? !!markedForReview[activeQuestion.question_id] : false;

  if (isLoading) {
    return (
      <ExamLoaderOverlay
        title="Structuring Practice Examination"
        subtitle="Retrieving authentic PYQs and configuring your student workspace..."
      />
    );
  }

  if (allQuestions.length === 0 || !activeQuestion) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          backgroundColor: '#F8FAFC',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: '40px 32px',
            maxWidth: 480,
            boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#172033', marginBottom: 8 }}>
            No Practice Questions Found
          </h2>
          <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 1.5 }}>
            No practice questions mapped to <strong>{formatEnum(gTopic || gSubject)}</strong> were
            found.
          </p>
          <button
            onClick={() => navigate('/mocks')}
            style={{
              padding: '12px 24px',
              borderRadius: 0,
              backgroundColor: '#E31B23',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(227, 27, 35, 0.2)',
            }}
          >
            Select Another Topic
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#F8FAFC',
      }}
    >
      {/* Top Header Bar */}
      <ExamHeader
        examTitle={gExam}
        paperSubtitle={`${gExam} · ${gYear}${gTopic ? ' · ' + gTopic : ''}`}
        timeLeft={timeLeft}
        language={language}
        showSubmitButton={true}
        showTimer={false}
        topicName={gTopic}
        subtopicName={''}
        parentBreadcrumb="Student Dashboard"
        onBack={() => setShowLeaveModal(true)}
        onLanguageChange={(lang) => setLanguage(lang)}
        onSubmitClick={() => handleFinishPracticeExam()}
        focusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
      />

      {/* Premium Floating Exam Filter Window (Same as Guest Exam Page) */}
      {!isFocusMode && (
      <div
        style={{
          marginTop: 60,
          padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2.5vw, 24px) 6px clamp(10px, 2.5vw, 24px)',
          backgroundColor: 'transparent',
          zIndex: 80,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 0,
            padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2.5vw, 18px)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 12px',
            boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
            position: 'relative',
          }}
        >
          {/* Filter Bar Badge (+ Hide/Show toggle on mobile/tablet, grouped on their own row) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isTabletOrBelow ? 'space-between' : 'flex-start',
              gap: 8,
              paddingRight: isTabletOrBelow ? 0 : 12,
              borderRight: isTabletOrBelow ? 'none' : '1px solid #F1F5F9',
              flexShrink: 0,
              flexBasis: isTabletOrBelow ? '100%' : 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 0,
                  backgroundColor: '#F8FAFC',
                  color: '#1E3A8A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SlidersHorizontal size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#1E3A8A',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  FILTERS
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                  Practice Engine
                </span>
              </div>
            </div>

            {/* Hide/Show Filters + Recs toggle — mobile/tablet only; filters always stay visible on desktop */}
            {isTabletOrBelow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setFiltersCollapsed((prev) => !prev)}
                  className="touch-target"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 0,
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                    color: '#1E3A8A',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title={filtersCollapsed ? 'Show Filters' : 'Hide Filters'}
                >
                  <span>{filtersCollapsed ? 'Show Filters' : 'Hide Filters'}</span>
                  <ChevronDown
                    size={13}
                    style={{
                      transform: filtersCollapsed ? 'none' : 'rotate(180deg)',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileRecs(true)}
                  className="touch-target"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#1E3A8A',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="Recommended Questions"
                >
                  <Sparkles size={13} color="#1E3A8A" />
                  <span>Recs ({displayRecs.length})</span>
                </button>
              </div>
            )}
          </div>

          {(!filtersCollapsed || !isTabletOrBelow) && (
            <>
              {/* Filter 1: Exam Target */}
              <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Exam Target
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'exam' ? null : 'exam');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border: activeDropdown === 'exam' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'exam' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'exam' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {gExam || 'UPSC CSE'}
                  </span>
                  <ChevronDown
                    size={14}
                    color="#64748B"
                    style={{
                      transform: activeDropdown === 'exam' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'exam' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 220,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 8,
                      zIndex: 100,
                    }}
                  >
                    {(availableExams.length > 0 ? availableExams : ['UPSC CSE', 'State PSC']).map(
                      (opt) => (
                        <div
                          key={opt}
                          onClick={() => {
                            const current = new URLSearchParams(searchParams);
                            current.set('exam', opt);
                            navigate(`/practice-exam?${current.toString()}`);
                            setActiveDropdown(null);
                          }}
                          style={{
                            padding: '9px 12px',
                            borderRadius: 0,
                            fontSize: 12.5,
                            fontWeight: gExam === opt ? 700 : 500,
                            color: gExam === opt ? '#1E3A8A' : '#334155',
                            backgroundColor: gExam === opt ? '#F8FAFC' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{opt}</span>
                          {gExam === opt && <Check size={14} color="#1E3A8A" />}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {/* Filter 2: Subject Focus */}
              <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Subject Focus
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'subject' ? null : 'subject');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border:
                      activeDropdown === 'subject' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'subject' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'subject' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {gSubject ? formatEnum(gSubject) : 'All Subjects'}
                  </span>
                  <ChevronDown
                    size={14}
                    color="#64748B"
                    style={{
                      transform: activeDropdown === 'subject' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'subject' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 250,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search
                        size={14}
                        color="#94A3B8"
                        style={{ position: 'absolute', left: 10, top: 10 }}
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search subject..."
                        value={filterSearchQuery}
                        onChange={(e) => setFilterSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px 7px 30px',
                          borderRadius: 0,
                          border: '1px solid #E2E8F0',
                          fontSize: 12,
                          outline: 'none',
                          boxSizing: 'border-box',
                          backgroundColor: '#F8FAFC',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        maxHeight: 180,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {subjectsList
                        .filter((s) => s.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                        .map((opt) => (
                          <div
                            key={opt}
                            onClick={() => {
                              const current = new URLSearchParams(searchParams);
                              if (opt === 'All Subjects') {
                                current.delete('subject');
                                current.delete('topic');
                              } else {
                                current.set('subject', opt);
                                current.delete('topic');
                              }
                              navigate(`/practice-exam?${current.toString()}`);
                              setActiveDropdown(null);
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 0,
                              fontSize: 12.5,
                              fontWeight: gSubject === opt ? 700 : 500,
                              color: gSubject === opt ? '#1E3A8A' : '#334155',
                              backgroundColor: gSubject === opt ? '#F8FAFC' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <span>{opt}</span>
                            {gSubject === opt && <Check size={14} color="#1E3A8A" />}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter 3: Specific Topic */}
              <div style={{ position: 'relative', flex: 1.3, minWidth: 170 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Specific Topic
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'topic' ? null : 'topic');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border: activeDropdown === 'topic' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'topic' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'topic' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {gTopic || 'All Topics'}
                  </span>
                  <ChevronDown
                    size={14}
                    color="#64748B"
                    style={{
                      transform: activeDropdown === 'topic' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'topic' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 270,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 10,
                      zIndex: 100,
                    }}
                  >
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search
                        size={14}
                        color="#94A3B8"
                        style={{ position: 'absolute', left: 10, top: 10 }}
                      />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search topics..."
                        value={filterSearchQuery}
                        onChange={(e) => setFilterSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px 7px 30px',
                          borderRadius: 0,
                          border: '1px solid #E2E8F0',
                          fontSize: 12,
                          outline: 'none',
                          boxSizing: 'border-box',
                          backgroundColor: '#F8FAFC',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        maxHeight: 200,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {availableTopics
                        .filter((t) => t.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                        .map((opt) => {
                          const isSelected = (opt === 'All Topics' && !gTopic) || gTopic === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                const current = new URLSearchParams(searchParams);
                                if (opt === 'All Topics') current.delete('topic');
                                else current.set('topic', opt);
                                navigate(`/practice-exam?${current.toString()}`);
                                setActiveDropdown(null);
                              }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 0,
                                fontSize: 12.5,
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#1E3A8A' : '#334155',
                                backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                              }}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check size={14} color="#1E3A8A" />}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filter 4: Difficulty */}
              <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
                <label
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Difficulty
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(activeDropdown === 'difficulty' ? null : 'difficulty');
                    setFilterSearchQuery('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 14px',
                    borderRadius: 0,
                    border:
                      activeDropdown === 'difficulty' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                    backgroundColor: activeDropdown === 'difficulty' ? '#FFFFFF' : '#F8FAFC',
                    color: '#172033',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow:
                      activeDropdown === 'difficulty' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{gDifficulty ? gDifficulty : 'All Levels'}</span>
                  <ChevronDown
                    size={14}
                    color="#64748B"
                    style={{
                      transform: activeDropdown === 'difficulty' ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {activeDropdown === 'difficulty' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      width: 170,
                      maxWidth: 'calc(100vw - 32px)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: 0,
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                      padding: 8,
                      zIndex: 100,
                    }}
                  >
                    {['All Levels', 'EASY', 'MEDIUM', 'HARD'].map((opt) => {
                      const isSelected =
                        (opt === 'All Levels' && !gDifficulty) || gDifficulty.toUpperCase() === opt;
                      return (
                        <div
                          key={opt}
                          onClick={() => {
                            const current = new URLSearchParams(searchParams);
                            if (opt === 'All Levels') current.delete('difficulty');
                            else current.set('difficulty', opt);
                            navigate(`/practice-exam?${current.toString()}`);
                            setActiveDropdown(null);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 0,
                            fontSize: 12.5,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? '#1E3A8A' : '#334155',
                            backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check size={14} color="#1E3A8A" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Mobile/Tablet Recommended Questions Modal */}
      {isTabletOrBelow && showMobileRecs && (
        <div
          className="auth-modal-overlay"
          onClick={() => setShowMobileRecs(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="auth-modal-card"
            style={{ maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="#1E3A8A" />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#1E3A8A',
                    textTransform: 'uppercase',
                  }}
                >
                  Cross Exam Questions ({displayRecs.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileRecs(false)}
                className="touch-target center-content"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label="Close recommendations"
              >
                <X size={20} />
              </button>
            </div>

            <RecommendedQuestionsPanel
              title={null}
              questions={displayRecs}
              isLoading={isPrefetchingRecs}
              expandedId={expandedRecId}
              selectedOptions={recUserResponses}
              solutions={recSolutions}
              solutionLoading={recSolutionLoading}
              onToggleExpand={handleSelectRecommendation}
              onSelectOption={handleSelectRecommendationOption}
            />
          </div>
        </div>
      )}
      {/* Main Console Workspace */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'visible',
          position: 'relative',
          backgroundColor: '#F8FAFC',
          gap: !isTabletOrBelow && !isFocusMode ? 20 : 0,
          marginTop: isFocusMode ? 60 : 0,
          paddingTop: 12,
          paddingBottom: 16,
          paddingRight: isTabletOrBelow ? 12 : 24,
          paddingLeft: isTabletOrBelow ? 12 : 24,
        }}
      >

        {/* Center Reading Canvas */}
        <ExamQuestionCard
          question={activeQuestion}
          questionIndex={currentQIndex}
          totalQuestions={totalQuestions}
          selectedOptionId={currentResponse?.optionId || null}
          selectedOptionLabel={currentResponse?.optionLabel || null}
          isBookmarked={!!bookmarkedQs[currentQIndex]}
          language={language}
          mode="PRACTICE"
          revealResult={currentRevealedResult}
          isRevealing={isSolutionLoading}
          onSelectOption={(optId, optLbl) => handleSelectOption(optId, optLbl)}
          onToggleBookmark={handleToggleBookmark}
          onRevealAnswer={() => handleRevealAnswer()}
          onShowSolution={() => handleShowSolution()}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onPrev={() => currentQIndex > 0 && handleSelectQuestion(currentQIndex - 1)}
          onNext={async () => {
            if (currentQIndex < totalQuestions - 1) {
              handleSelectQuestion(currentQIndex + 1);
            } else if (subjectFallbackPool.length > 0) {
              const loaded = handleLoadSubjectFallbackQuestions();
              if (loaded) handleSelectQuestion(currentQIndex + 1);
            } else if (isPrefetchingSubjectFallback) {
              setIsLoading(true);
              let attempts = 0;
              while (isPrefetchingSubjectFallback && attempts < 10) {
                await new Promise((r) => setTimeout(r, 200));
                attempts++;
              }
              setIsLoading(false);
              if (subjectFallbackPool.length > 0) {
                const loaded = handleLoadSubjectFallbackQuestions();
                if (loaded) handleSelectQuestion(currentQIndex + 1);
              } else {
                setShowNoMoreQuestionsModal(true);
              }
            } else {
              setShowNoMoreQuestionsModal(true);
            }
          }}
        />

        {/* Right Side Recommended Questions Fixed Sidebar (Desktop) */}
        {!isTabletOrBelow && !isFocusMode && (
          <aside
            style={{
              width: 380,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 14px',
              gap: 14,
              overflowY: 'auto',
              flexShrink: 0,
              height: '100%',
              boxShadow:
                '0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
            }}
          >
            <RecommendedQuestionsPanel
              subtitle={`Matched questions for ${gSubject || 'your focus area'}.`}
              questions={displayRecs}
              isLoading={isPrefetchingRecs}
              expandedId={expandedRecId}
              selectedOptions={recUserResponses}
              solutions={recSolutions}
              solutionLoading={recSolutionLoading}
              onToggleExpand={handleSelectRecommendation}
              onSelectOption={handleSelectRecommendationOption}
            />
          </aside>
        )}
      </div>

      {/* Topic Completion & Subject Question Expansion Pop-up Banner */}
      {topicCompletionBanner && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            backgroundColor: '#172033',
            color: '#FFFFFF',
            borderRadius: 0,
            padding: '14px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            maxWidth: 520,
            width: '90%',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 0,
              backgroundColor: '#E31B23',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} color="#FFFFFF" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#60A5FA',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 2,
              }}
            >
              Topic Complete &bull; Questions Expanded
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F8FAFC', lineHeight: 1.35 }}>
              {topicCompletionBanner}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTopicCompletionBanner(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 700,
              padding: 4,
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Floating 10-Second Post-Exam Countdown Banner */}
      {scoreCountdown !== null && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 990,
            backgroundColor: '#172033',
            color: '#FFFFFF',
            borderRadius: 0,
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.35)',
            border: '1.5px solid rgba(255, 255, 255, 0.15)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 0,
                backgroundColor: '#E31B23',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {scoreCountdown}
            </span>
            <span>Practice Finished! Showing score report in {scoreCountdown}s...</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setScoreCountdown(null);
              setShowScoreModal(true);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: 'none',
              backgroundColor: '#E31B23',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            View Score Now &rsaquo;
          </button>
        </div>
      )}

      {/* Completion Score Modal */}
      <GuestScoreModal
        isOpen={showScoreModal}
        scoreData={guestScoreData}
        isGuest={false}
        onClose={() => setShowScoreModal(false)}
        onRetake={() => {
          setShowScoreModal(false);
          setRevealedMap({});
          setUserResponses({});
          setMarkedForReview({});
          setCurrentQIndex(0);
        }}
      />

      {/* Leave Practice Session Pop-up Modal */}
      {showLeaveModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              padding: 32,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
              border: '1px solid #E2E8F0',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#172033', margin: '0 0 8px 0' }}>
              Leave Practice Session?
            </h3>

            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 22px 0' }}>
              Your current practice progress is temporarily saved in your browser. You can return
              anytime.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 0,
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Continue Practice
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  navigate('/mocks');
                }}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                Leave Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No More Questions Available Pop-up Modal */}
      {showNoMoreQuestionsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              padding: '32px 28px',
              border: '1.5px solid #E2E8F0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              textAlign: 'center',
              fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 0,
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#3A8B53',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <CheckCircle2 size={28} color="#3A8B53" />
            </div>

            <div
              style={{
                display: 'inline-block',
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 0,
                marginBottom: 10,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Subject Practice Complete
            </div>

            <h3
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#172033',
                margin: '0 0 10px 0',
                lineHeight: 1.3,
              }}
            >
              No More Questions Available
            </h3>

            <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              You've completed all available practice questions for{' '}
              <strong>{gSubject || 'this subject'}</strong>. Try selecting a different subject or
              topic to continue practicing!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setShowNoMoreQuestionsModal(false);
                  navigate('/practice-tests');
                }}
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: '#1E3A8A',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(23, 32, 51, 0.3)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#C1121F';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1E3A8A';
                }}
              >
                Select Another Subject &rsaquo;
              </button>

              <button
                type="button"
                onClick={() => setShowNoMoreQuestionsModal(false)}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 0,
                  border: '1.5px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#64748B',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.color = '#334155';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.color = '#64748B';
                }}
              >
                Review Attempted Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
