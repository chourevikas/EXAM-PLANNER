import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { GuestScoreModal } from '../components/exam/GuestScoreModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { Loader2, AlertCircle, ArrowLeft, RotateCcw, Search, ChevronDown, ChevronRight, Check, SlidersHorizontal, Sparkles, GraduationCap, X } from 'lucide-react';
import { QuestionOut, QuestionPaletteItem, RevealAnswerResponse } from '../types/exam';
import { saveGuestAttempt } from '../utils/guestStorage';
import { fetchMasterSyllabus, fetchExamsByYear, verifySyllabusNode } from '../services/examService';
import { useBreakpoint } from '../hooks/useBreakpoint';

export function GuestExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL Params (Max 10 questions allowed)
  const gExam = searchParams.get('exam') || 'UPSC CSE';
  const gYear = searchParams.get('year') || '';
  const gSubject = searchParams.get('subject') || 'Polity';
  const gTopic = searchParams.get('topic') || '';
  const gSubtopic = searchParams.get('subtopic') || '';
  const gDifficulty = searchParams.get('difficulty') || '';
  const rawCount = parseInt(searchParams.get('count') || '10', 10);
  const gCount = Math.min(10, Math.max(1, rawCount));

  // Dynamic 3-level taxonomy fetched directly from Syllabus API (/api/v1/syllabus)
  const [masterSubjects, setMasterSubjects] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [threeLevelHierarchy, setThreeLevelHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [availableYearsList, setAvailableYearsList] = useState<number[]>([]);

  // Fetch dynamic master syllabus taxonomy (/api/v1/syllabus) & exams by year (/api/v1/exams/by-year)
  useEffect(() => {
    async function loadTaxonomyAndYears() {
      try {
        const syllabusData = await fetchMasterSyllabus();
        if (syllabusData) {
          if (syllabusData.subjects && Array.isArray(syllabusData.subjects) && syllabusData.subjects.length > 0) {
            setMasterSubjects(syllabusData.subjects);
          }
          if (syllabusData.subjects_list && Array.isArray(syllabusData.subjects_list)) {
            const cleanSubs = syllabusData.subjects_list.filter((s: string) => s !== 'All Subjects' && s.trim() !== '');
            if (cleanSubs.length > 0) {
              setSubjectsList(cleanSubs);
            }
          }
          if (syllabusData.hierarchy && typeof syllabusData.hierarchy === 'object') {
            setThreeLevelHierarchy(syllabusData.hierarchy);
          }
        }

        const yearsData = await fetchExamsByYear();
        if (yearsData && Array.isArray(yearsData.years)) {
          setAvailableYearsList(yearsData.years);
        }
      } catch (err) {
        console.warn('Failed to fetch syllabus taxonomy or exam years:', err);
      }
    }
    loadTaxonomyAndYears();
  }, []);

  // Dynamically mapped topics for selected subject (derived 100% from DB taxonomy API)
  const availableTopics = useMemo(() => {
    const defaultList = ['All Topics'];
    if (!gSubject) return defaultList;

    const currentSubj = masterSubjects.find(
      (s) => s.name === gSubject || s.name.toLowerCase().includes(gSubject.toLowerCase())
    );
    if (currentSubj && currentSubj.topics && Array.isArray(currentSubj.topics) && currentSubj.topics.length > 0) {
      const topicNames = currentSubj.topics.map((t: any) => t.name).filter((n: string) => n && n.trim() !== '' && !n.startsWith('All Topics'));
      if (topicNames.length > 0) return [...defaultList, ...topicNames];
    }

    const dbTopicMap = threeLevelHierarchy[gSubject];
    if (dbTopicMap && typeof dbTopicMap === 'object') {
      const dbTopics = Object.keys(dbTopicMap).filter((k) => k.trim() !== '' && !k.startsWith('All Topics'));
      if (dbTopics.length > 0) {
        return [...defaultList, ...dbTopics];
      }
    }
    return defaultList;
  }, [gSubject, masterSubjects, threeLevelHierarchy]);




  // Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(gCount);
  const [timeLeft, setTimeLeft] = useState(gCount * 120);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'marked' | 'unanswered'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Collapsible Left Drawer State (CLOSED BY DEFAULT)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Question & Response Data
  const [allQuestions, setAllQuestions] = useState<QuestionOut[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionOut | null>(null);
  const [userResponses, setUserResponses] = useState<Record<string, { optionId: string; optionLabel: string }>>({});
  const [revealedMap, setRevealedMap] = useState<Record<string, RevealAnswerResponse>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});
  const [palette, setPalette] = useState<QuestionPaletteItem[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [guestScoreData, setGuestScoreData] = useState<any>(null);
  const [scoreCountdown, setScoreCountdown] = useState<number | null>(null);

  // Dynamic Recommended Questions Pool
  const [recommendedPool, setRecommendedPool] = useState<QuestionOut[]>([]);
  const [isPrefetchingRecs, setIsPrefetchingRecs] = useState(false);

  // Mobile Responsiveness & Custom Dropdown Search State
  const { isMobile, isTabletOrBelow } = useBreakpoint();
  const [showMobileRecs, setShowMobileRecs] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');

  const SESSION_KEY = `guest_exam_session_${gExam}_${gYear}_${gSubject}_${gTopic}_${gSubtopic}_${gCount}`;

  // Background prefetch function for dynamic recommended questions
  const prefetchRecommendations = useCallback(async (currentTestQuestions: QuestionOut[], currentPool: QuestionOut[]) => {
    if (isPrefetchingRecs) return;
    setIsPrefetchingRecs(true);

    try {
      const existingIds = new Set<string>();
      currentTestQuestions.forEach((q) => { if (q.question_id) existingIds.add(q.question_id); });
      currentPool.forEach((q) => { if (q.question_id) existingIds.add(q.question_id); });

      const excludeIdsParam = Array.from(existingIds).join(',');

      const rawSubject = gSubject && !gSubject.startsWith('All Subjects') ? gSubject.trim() : '';
      let querySubject = rawSubject;
      let queryTopic = gTopic && !gTopic.startsWith('All Topics') ? gTopic.trim() : '';
      const targetExam = gExam ? (gExam.toLowerCase().includes('upsc') ? 'upsc' : gExam.toLowerCase().trim()) : '';

      if (querySubject || queryTopic) {
        try {
          const verifyRes = await verifySyllabusNode({ subject: querySubject, topic: queryTopic });
          if (verifyRes && verifyRes.is_valid) {
            if (verifyRes.canonical_subject) querySubject = verifyRes.canonical_subject;
            if (verifyRes.canonical_topic) queryTopic = verifyRes.canonical_topic;
          }
        } catch (err) {
          // ignore verification fallback
        }
      }

      // Step 1: Exact subject + topic with exclude_ids
      const params = new URLSearchParams({ limit: '5' });
      if (querySubject) params.append('subject_name', querySubject);
      if (queryTopic) params.append('topic_name', queryTopic);
      if (targetExam) params.append('exam_name', targetExam);
      if (excludeIdsParam) params.append('exclude_ids', excludeIdsParam);

      let res = await fetch(`/api/v1/questions?${params.toString()}`);
      let newFetched: any[] = [];
      if (res.ok) {
        const data = await res.json();
        newFetched = data.items || [];
      }

      // Step 2: Fallback - relax topic while preserving subject
      if (newFetched.length === 0 && querySubject) {
        const fallbackParams = new URLSearchParams({ limit: '5' });
        fallbackParams.append('subject_name', querySubject);
        if (targetExam) fallbackParams.append('exam_name', targetExam);
        if (excludeIdsParam) fallbackParams.append('exclude_ids', excludeIdsParam);

        res = await fetch(`/api/v1/questions?${fallbackParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          newFetched = data.items || [];
        }
      }

      if (newFetched.length > 0) {
        const formatted: QuestionOut[] = newFetched.map((item: any, idx: number) => {
          const rawOptions = item.options || [];
          const optionsList = rawOptions.map((o: any, oIdx: number) => ({
            option_id: o.option_id || `opt-rec-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
            option_label: o.option_label || String.fromCharCode(65 + oIdx),
            text: o.option_text || o.text || `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
            is_correct: Boolean(o.is_correct),
          }));
          return {
            question_id: item.question_id,
            question_number: 0,
            text: item.question_text || item.text || '',
            options: optionsList,
            section_code: item.topic_name || item.subject_name || querySubject || 'Recommended',
            topic_name: item.topic_name || queryTopic,
            subtopic_name: item.subtopic_name,
            difficulty: item.difficulty || 'MEDIUM',
            marks: item.marks || 2.0,
            negative_marks: item.negative_marks || 0.66,
            expected_time_seconds: item.expected_time_seconds || 60,
            explanation: item.explanation || item.explanation_text || '',
          } as any;
        });

        setRecommendedPool((prev) => {
          const combinedMap = new Map<string, QuestionOut>();
          prev.forEach((q) => combinedMap.set(q.question_id, q));
          formatted.forEach((q) => {
            if (!existingIds.has(q.question_id) && !combinedMap.has(q.question_id)) {
              combinedMap.set(q.question_id, q);
            }
          });
          return Array.from(combinedMap.values()).slice(0, 5);
        });
      }
    } catch (err) {
      console.warn('Background recommendation prefetch error:', err);
    } finally {
      setIsPrefetchingRecs(false);
    }
  }, [gSubject, gTopic, gExam, isPrefetchingRecs]);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Post-Exam Score Modal 10s Countdown Effect
  useEffect(() => {
    if (scoreCountdown === null) return;
    if (scoreCountdown <= 0) {
      setScoreCountdown(null);
      setShowScoreModal(true);
      return;
    }
    const timer = setTimeout(() => {
      setScoreCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [scoreCountdown]);

  // Fetch Guest Questions strictly from DB
  useEffect(() => {
    async function loadGuestQuestions() {
      setIsLoading(true);

      const fetchedMap = new Map<string, any>();

      const formatQuestion = (q: any, idx: number): QuestionOut => {
        const rawOptions = q.options || [];
        const optionsList = rawOptions.map((o: any, oIdx: number) => ({
          option_id: o.option_id || `opt-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
          option_label: o.option_label || String.fromCharCode(65 + oIdx),
          text: o.option_text || o.text || `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
          is_correct: Boolean(o.is_correct),
        }));

        const expText = q.explanation || q.explanation_text || q.description || q.solution || q.solution_text || '';

        return {
          question_id: q.question_id || `q-guest-${idx + 1}`,
          question_number: idx + 1,
          text: q.question_text || q.text || '',
          options: optionsList,
          section_code: q.topic_name || q.subject_name || gTopic || 'General Studies',
          topic_name: q.topic_name || gTopic,
          subtopic_name: q.subtopic_name || gSubtopic,
          difficulty: q.difficulty || 'MEDIUM',
          marks: q.marks || 2.0,
          negative_marks: q.negative_marks || 0.66,
          expected_time_seconds: q.expected_time_seconds || 60,
          explanation: expText,
        } as any;
      };

      const fetchWithParams = async (params: URLSearchParams) => {
        try {
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
          console.warn('Questions fetch error:', err);
        }
      };

      const rawSubject = gSubject && !gSubject.startsWith('All Subjects') ? gSubject.trim() : '';
      let querySubject = rawSubject;
      let queryTopic = gTopic && !gTopic.startsWith('All Topics') ? gTopic.trim() : '';

      if (querySubject || queryTopic) {
        try {
          const verifyRes = await verifySyllabusNode({ subject: querySubject, topic: queryTopic });
          if (verifyRes && verifyRes.is_valid) {
            if (verifyRes.canonical_subject) querySubject = verifyRes.canonical_subject;
            if (verifyRes.canonical_topic) queryTopic = verifyRes.canonical_topic;
          }
        } catch (err) {
          console.warn('Syllabus node verification check failed, using raw query params:', err);
        }
      }

      const targetExam = gExam ? (gExam.toLowerCase().includes('upsc') ? 'upsc' : gExam.toLowerCase().trim()) : '';

      // 1. Try with subject + topic + year + selected exam
      const p1 = new URLSearchParams({ limit: gCount.toString() });
      if (querySubject) {
        p1.append('subject_name', querySubject);
      }
      if (queryTopic) {
        p1.append('topic_name', queryTopic);
      }
      const rawYearDigits = gYear.replace(/\D/g, '');
      if (rawYearDigits && !isNaN(Number(rawYearDigits)) && Number(rawYearDigits) >= 2000 && Number(rawYearDigits) <= 2024) {
        p1.append('exam_year', rawYearDigits);
      }
      if (targetExam) {
        p1.append('exam_name', targetExam);
      }
      await fetchWithParams(p1);

      // 2. Fallback: Relax year if 0 questions found for exact year (keep subject + topic)
      if (fetchedMap.size === 0 && queryTopic) {
        const p2 = new URLSearchParams({ limit: gCount.toString() });
        if (querySubject) {
          p2.append('subject_name', querySubject);
        }
        p2.append('topic_name', queryTopic);
        if (targetExam) {
          p2.append('exam_name', targetExam);
        }
        await fetchWithParams(p2);
      }

      // 3. Fallback: Relax topic to subject if still 0 questions found (keep subject)
      if (fetchedMap.size === 0 && querySubject) {
        const p3 = new URLSearchParams({ limit: gCount.toString() });
        p3.append('subject_name', querySubject);
        if (targetExam) {
          p3.append('exam_name', targetExam);
        }
        await fetchWithParams(p3);
      }

      // 4. Fallback: Try raw subject if canonical subject differed (keep subject)
      if (fetchedMap.size === 0 && rawSubject && rawSubject !== querySubject) {
        const p4 = new URLSearchParams({ limit: gCount.toString() });
        p4.append('subject_name', rawSubject);
        if (targetExam) {
          p4.append('exam_name', targetExam);
        }
        await fetchWithParams(p4);
      }

      // 5. Fallback: Relax exam filter but strictly keep subject_name if user selected a subject
      if (fetchedMap.size === 0 && (querySubject || rawSubject)) {
        const p5 = new URLSearchParams({ limit: gCount.toString() });
        p5.append('subject_name', querySubject || rawSubject);
        await fetchWithParams(p5);
      }

      // 6. Fallback: Only if user explicitly chose "All Subjects" (no subject selected)
      if (fetchedMap.size === 0 && !rawSubject) {
        const p6 = new URLSearchParams({ limit: gCount.toString() });
        if (targetExam) {
          p6.append('exam_name', targetExam);
        }
        await fetchWithParams(p6);
      }

      const fetchedList = Array.from(fetchedMap.values());
      let questionsList: QuestionOut[] = fetchedList.map((item, idx) => formatQuestion(item, idx));
      if (gDifficulty && gDifficulty.trim()) {
        const filteredByDiff = questionsList.filter(
          (q) => String(q.difficulty || '').toUpperCase() === gDifficulty.toUpperCase()
        );
        if (filteredByDiff.length > 0) {
          questionsList = filteredByDiff;
        }
      }
      if (questionsList.length > gCount) {
        questionsList = questionsList.slice(0, gCount);
      }

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
            if (typeof savedData.currentQIndex === 'number' && savedData.currentQIndex >= 0 && savedData.currentQIndex < questionsList.length) {
              setCurrentQIndex(savedData.currentQIndex);
              setActiveQuestion(questionsList[savedData.currentQIndex]);
            }
          }
        } catch (err) {
          console.warn('Failed to restore guest sessionStorage:', err);
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

    loadGuestQuestions();
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
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write guest sessionStorage:', err);
    }
  }, [userResponses, revealedMap, markedForReview, bookmarkedQs, currentQIndex, isLoading, allQuestions]);

  // Auto-prefetch background recommendations whenever pool has fewer than 5 items
  useEffect(() => {
    if (allQuestions.length > 0 && recommendedPool.length < 5 && !isPrefetchingRecs) {
      prefetchRecommendations(allQuestions, recommendedPool);
    }
  }, [allQuestions, recommendedPool, isPrefetchingRecs, prefetchRecommendations]);

  // Handler to jump to or prompt login for recommended question outside 10 Q limit
  const handleSelectRecommendation = (recQ: QuestionOut) => {
    const existingIdx = allQuestions.findIndex((q) => q.question_id === recQ.question_id);
    if (existingIdx !== -1) {
      setCurrentQIndex(existingIdx);
      setActiveQuestion(allQuestions[existingIdx]);
      return;
    }

    // Guest user limit reached (10 questions max) -> Show Login Pop-up Modal
    setShowLoginModal(true);
  };

  // Compute 5 recommendation cards to display (upcoming test questions + prefetched pool)
  const displayRecs = useMemo(() => {
    const combinedMap = new Map<string, QuestionOut>();
    recommendedPool.forEach((q) => {
      if (q.question_id !== activeQuestion?.question_id) {
        combinedMap.set(q.question_id, q);
      }
    });
    allQuestions.forEach((q) => {
      if (!combinedMap.has(q.question_id) && q.question_id !== activeQuestion?.question_id) {
        combinedMap.set(q.question_id, q);
      }
    });
    return Array.from(combinedMap.values()).slice(0, 5);
  }, [allQuestions, activeQuestion, recommendedPool]);

  // Switch Question
  const handleSelectQuestion = (idx: number) => {
    if (idx < 0 || idx >= totalQuestions || idx >= allQuestions.length) return;
    setCurrentQIndex(idx);
    setActiveQuestion(allQuestions[idx]);

    setPalette((prev) =>
      prev.map((item, i) => {
        if (i === idx && item.question_status === 'UNVISITED') {
          return { ...item, question_status: 'VISITED' as any };
        }
        return item;
      })
    );
  };

  // Option Selection
  const handleSelectOption = (optId: string, optLabel: string) => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;

    setUserResponses((prev) => ({
      ...prev,
      [qId]: { optionId: optId, optionLabel: optLabel },
    }));
  };

  // Reveal Instant Per-Question Answer & Description with Full Markdown Solution
  const handleRevealAnswer = async (qId?: string) => {
    const targetId = qId || activeQuestion?.question_id;
    if (!targetId) return;

    const targetQuestion = allQuestions.find((q) => q.question_id === targetId) || activeQuestion;
    if (!targetQuestion) return;

    const cleanOptionLabel = (rawLabel: string, index: number): string => {
      if (!rawLabel) return String.fromCharCode(65 + index);
      const clean = String(rawLabel).replace(/[\(\)\.\s]/g, '').toUpperCase();
      return clean.length === 1 ? clean : String.fromCharCode(65 + index);
    };

    let userResp = userResponses[targetId];
    if (!userResp) return;
    const correctOpt = targetQuestion.options?.find((o) => o.is_correct);

    let isUserCorrect = false;
    if (userResp && targetQuestion.options) {
      const selectedOpt = targetQuestion.options.find(
        (o, idx) => o.option_id === userResp.optionId || cleanOptionLabel(o.option_label || '', idx) === userResp.optionLabel
      );
      if (selectedOpt && selectedOpt.is_correct) {
        isUserCorrect = true;
      }
    }

    const correctOptIndex = targetQuestion.options?.findIndex((o) => o.is_correct) ?? 0;
    const correctLabel = correctOpt ? cleanOptionLabel(correctOpt.option_label || '', correctOptIndex) : 'A';

    const expContent = (targetQuestion as any).explanation || `Option (${correctLabel}) is correct for this question on ${targetQuestion.topic_name || gTopic}.`;

    const revealObj: RevealAnswerResponse & { presigned_url?: string } = {
      question_id: targetId,
      question_number: targetQuestion.question_number,
      correct_option_id: correctOpt?.option_id || '',
      correct_option_label: correctLabel,
      is_user_correct: isUserCorrect,
      user_selected_option_id: userResp?.optionId || null,
      user_selected_label: userResp?.optionLabel || null,
      marks_awarded: isUserCorrect ? (targetQuestion.marks || 2.0) : -(targetQuestion.negative_marks || 0.66),
      closeness_score: isUserCorrect ? 1.0 : 0.0,
      closeness_classification: isUserCorrect ? 'Correct Response' : 'Incorrect Response',
      explanation: expContent,
      distractor_scores: {},
    };

    const updatedRevealedMap = {
      ...revealedMap,
      [targetId]: revealObj,
    };

    setRevealedMap(updatedRevealedMap);

    // Update palette question_status on Submit
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
      })
    );
  };

  // Lazy-fetch full detailed solution metadata when user clicks 'Show Solution'
  const handleShowSolution = async (passedRevealedMap?: Record<string, RevealAnswerResponse>) => {
    const targetId = activeQuestion?.question_id;
    if (targetId) {
      const existingRevealed = revealedMap[targetId];
      // Lazy fetch detailed explanation artifact from solution API if not already enriched
      if (!existingRevealed || !existingRevealed.distractor_scores || Object.keys(existingRevealed.distractor_scores).length === 0) {
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
                  correct_option_label: solPayload.correct_option_label || current.correct_option_label,
                  explanation: solPayload.explanation || current.explanation,
                  distractor_scores: solPayload.distractor_scores || current.distractor_scores,
                  presigned_url: solPayload.presigned_url || (current as any).presigned_url,
                },
              };
            });
          }
        } catch (err) {
          console.warn('Lazy solution fetch error:', err);
        }
      }
    }

    const rMap = passedRevealedMap || revealedMap;
    const numQuestions = allQuestions.length;
    // When Show Solution is clicked, if test is completed (or 1 question), start 10s countdown to feedback modal
    const isCompleted = Object.keys(rMap).length >= numQuestions || numQuestions === 1;
    if (isCompleted && scoreCountdown === null && !showScoreModal) {
      handleFinishGuestExam(rMap, true);
    }
  };

  const handleFinishGuestExam = (passedRevealedMap?: Record<string, RevealAnswerResponse>, startCountdown: boolean = false) => {
    const rMap = passedRevealedMap || revealedMap;
    const numQuestions = allQuestions.length;
    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;

    const cleanOptionLabel = (rawLabel: string, index: number): string => {
      if (!rawLabel) return String.fromCharCode(65 + index);
      const clean = String(rawLabel).replace(/[\(\)\.\s]/g, '').toUpperCase();
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
          (o, oIdx) => o.option_id === userResp.optionId || cleanOptionLabel(o.option_label || '', oIdx) === userResp.optionLabel
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
      topicName: gTopic || gSubject,
      subtopicName: gSubtopic,
      targetExam: gExam,
      targetYear: gYear,
      timeSpentSeconds: Math.max(30, (gCount * 120) - timeLeft),
      responses: responsesPayload,
    };

    setGuestScoreData(scorePayload);
    saveGuestAttempt(scorePayload);

    if (startCountdown) {
      setScoreCountdown(10);
    } else {
      setScoreCountdown(null);
      setShowScoreModal(true);
    }
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
      })
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
            return { ...item, question_status: isSubmitted ? ('ANSWERED_AND_MARKED' as any) : ('MARKED_FOR_REVIEW' as any) };
          }
          return { ...item, question_status: isSubmitted ? ('ANSWERED' as any) : ('VISITED' as any) };
        }
        return item;
      })
    );
  };

  if (isLoading) {
    return (
      <ExamLoaderOverlay
        title="Preparing Mock Examination"
        subtitle="Structuring authentic PYQs and setting up your workspace..."
      />
    );
  }

  if (!activeQuestion || allQuestions.length === 0) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: 0,
            padding: '36px 32px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 0,
              backgroundColor: '#FEF3C7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F2B623',
              marginBottom: 16,
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#172033', margin: '0 0 8px 0' }}>
            No Questions Found
          </h2>
          <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            No questions match your current selection (Subject: <strong>{gSubject}</strong>{gTopic ? `, Topic: ${gTopic}` : ''}{gSubtopic ? `, Subtopic: ${gSubtopic}` : ''}).
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate(`/guest-exam?subject=${encodeURIComponent(gSubject)}&count=10`)}
              style={{
                padding: '10px 18px',
                borderRadius: 0,
                backgroundColor: '#E31B23',
                color: '#FFFFFF',
                fontSize: 13.5,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RotateCcw size={15} />
              Practice All {gSubject} Questions
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                padding: '10px 18px',
                borderRadius: 0,
                backgroundColor: '#F1F5F9',
                color: '#475569',
                fontSize: 13.5,
                fontWeight: 600,
                border: '1px solid #E2E8F0',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeft size={15} />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentResponse = userResponses[activeQuestion.question_id];
  const isCurrentAnswered = !!currentResponse;
  const isCurrentMarked = !!markedForReview[activeQuestion.question_id];
  const currentRevealedResult = revealedMap[activeQuestion.question_id] || null;

  const selectedOptionsMap: Record<number, string> = {};
  allQuestions.forEach((q, idx) => {
    if (userResponses[q.question_id]) {
      selectedOptionsMap[idx] = userResponses[q.question_id].optionId;
    }
  });

  const markedForReviewMap: Record<number, boolean> = {};
  allQuestions.forEach((q, idx) => {
    if (markedForReview[q.question_id]) {
      markedForReviewMap[idx] = true;
    }
  });

  const answeredCount = Object.keys(revealedMap).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = Math.max(0, totalQuestions - answeredCount);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#F8FAF8',
        color: '#172033',
        fontFamily: "'Manrope', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* 1. Top Application Header */}
      <header
        style={{
          height: 64,
          background: 'linear-gradient(90deg, #0F1D38 0%, #14284C 35%, #1B3864 70%, #224578 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(15, 29, 56, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          zIndex: 30,
          flexShrink: 0,
        }}
      >
        {/* Left: Brand Icon, ExamPlanner Title & Clickable Home > Test Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Logo Badge Icon */}
          <div
            onClick={() => navigate('/')}
            style={{
              width: 36,
              height: 36,
              borderRadius: 0,
              backgroundColor: '#E31B23',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
              boxShadow: '0 2px 10px rgba(227, 27, 35, 0.4)',
              cursor: 'pointer',
            }}
            title="Go to Home"
          >
            EP
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span 
                onClick={() => navigate('/')}
                style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.01em', cursor: 'pointer' }}
              >
                ExamPlanner
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.4)' }}>|</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
                PYQs Practice Engine
              </span>
            </div>

            {/* Breadcrumb: Home (Link) > Test (Current Page) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600 }}>
              <span
                onClick={() => navigate('/')}
                style={{
                  color: 'rgba(255, 255, 255, 0.75)',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
              >
                Home
              </span>
              <ChevronRight size={12} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
              <span style={{ color: '#93C5FD', cursor: 'default' }}>
                Test
              </span>
            </div>
          </div>
        </div>

        {/* Right: End & View Feedback action button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => handleFinishGuestExam()}
            style={{
              padding: '7px 18px',
              borderRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              backgroundColor: 'rgba(255, 255, 255, 0.09)',
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backdropFilter: 'blur(4px)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.09)';
            }}
          >
            End & View Feedback
          </button>
        </div>
      </header>
      {/* 2. Premium Floating Exam Filter Window */}
      <div
        style={{
          padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2.5vw, 24px) 6px clamp(10px, 2.5vw, 24px)',
          backgroundColor: 'transparent',
          zIndex: 40,
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
          {/* Filter Bar Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingRight: 12,
              borderRight: '1px solid #F1F5F9',
              flexShrink: 0,
            }}
          >
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
              <span style={{ fontSize: 11, fontWeight: 800, color: '#1E3A8A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                FILTERS
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                Practice Engine
              </span>
            </div>
          </div>

          {/* Filter 1: Exam */}
          <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
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
                boxShadow: activeDropdown === 'exam' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gExam}</span>
              <ChevronDown size={14} color="#64748B" style={{ transform: activeDropdown === 'exam' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {/* Exam Popover */}
            {activeDropdown === 'exam' && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: 220,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                  padding: 8,
                  zIndex: 100,
                }}
              >
                {['UPSC CSE', 'State PSC'].map((opt) => (
                  <div
                    key={opt}
                    onClick={() => {
                      navigate(`/guest-exam?exam=${encodeURIComponent(opt)}&subject=${encodeURIComponent(gSubject)}&topic=${encodeURIComponent(gTopic)}&subtopic=${encodeURIComponent(gSubtopic)}&count=${gCount}`);
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
                      transition: 'backgroundColor 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (gExam !== opt) e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }}
                    onMouseLeave={(e) => {
                      if (gExam !== opt) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span>{opt}</span>
                    {gExam === opt && <Check size={14} color="#1E3A8A" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filter 2: Subject */}
          <div style={{ position: 'relative', flex: 1.2, minWidth: 160 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
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
                border: activeDropdown === 'subject' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                backgroundColor: activeDropdown === 'subject' ? '#FFFFFF' : '#F8FAFC',
                color: '#172033',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: activeDropdown === 'subject' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gSubject}</span>
              <ChevronDown size={14} color="#64748B" style={{ transform: activeDropdown === 'subject' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {/* Subject Popover with Premium Search */}
            {activeDropdown === 'subject' && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: 250,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                  padding: 10,
                  zIndex: 100,
                }}
              >
                {/* Internal Search Bar */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
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

                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(subjectsList.length > 0 ? subjectsList : (Object.keys(threeLevelHierarchy).length > 0 ? Object.keys(threeLevelHierarchy) : ['Polity', 'History', 'Economy', 'Geography', 'Environment', 'Science & Technology']))
                    .filter((s) => s.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                    .map((opt) => (
                      <div
                        key={opt}
                        onClick={() => {
                          navigate(`/guest-exam?exam=${encodeURIComponent(gExam)}&subject=${encodeURIComponent(opt)}&count=${gCount}`);
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
                        onMouseEnter={(e) => {
                          if (gSubject !== opt) e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          if (gSubject !== opt) e.currentTarget.style.backgroundColor = 'transparent';
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

          {/* Filter 3: Topic */}
          <div style={{ position: 'relative', flex: 1.3, minWidth: 170 }}>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
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
                boxShadow: activeDropdown === 'topic' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gTopic || 'All Topics'}</span>
              <ChevronDown size={14} color="#64748B" style={{ transform: activeDropdown === 'topic' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {/* Topic Popover with Premium Search */}
            {activeDropdown === 'topic' && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: 270,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                  padding: 10,
                  zIndex: 100,
                }}
              >
                {/* Search Field */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
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

                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {availableTopics
                    .filter((t) => t.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                    .map((opt) => {
                      const isSelected = (opt === 'All Topics' && !gTopic) || gTopic === opt;
                      return (
                        <div
                          key={opt}
                          onClick={() => {
                            const val = opt === 'All Topics' ? '' : opt;
                            navigate(`/guest-exam?exam=${encodeURIComponent(gExam)}&subject=${encodeURIComponent(gSubject)}&topic=${encodeURIComponent(val)}&count=${gCount}`);
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
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
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
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>
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
                border: activeDropdown === 'difficulty' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                backgroundColor: activeDropdown === 'difficulty' ? '#FFFFFF' : '#F8FAFC',
                color: '#172033',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: activeDropdown === 'difficulty' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{gDifficulty ? gDifficulty : 'All Levels'}</span>
              <ChevronDown size={14} color="#64748B" style={{ transform: activeDropdown === 'difficulty' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {/* Difficulty Popover */}
            {activeDropdown === 'difficulty' && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: 170,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                  padding: 8,
                  zIndex: 100,
                }}
              >
                {['All Levels', 'EASY', 'MEDIUM', 'HARD'].map((opt) => {
                  const isSelected = (opt === 'All Levels' && !gDifficulty) || gDifficulty.toUpperCase() === opt;
                  return (
                    <div
                      key={opt}
                      onClick={() => {
                        const val = opt === 'All Levels' ? '' : opt;
                        navigate(`/guest-exam?exam=${encodeURIComponent(gExam)}&subject=${encodeURIComponent(gSubject)}&topic=${encodeURIComponent(gTopic)}&difficulty=${encodeURIComponent(val)}&count=${gCount}`);
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
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
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
        </div>
      </div>

      {/* Mobile Recommended Questions Toggle Button */}
      {isMobile && displayRecs.length > 0 && (
        <div style={{ padding: '0 clamp(10px, 2.5vw, 24px) 8px', display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            onClick={() => setShowMobileRecs(true)}
            className="touch-target center-content"
            style={{
              padding: '6px 14px',
              borderRadius: 0,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#1E3A8A',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
            }}
          >
            <Sparkles size={14} color="#1E3A8A" />
            <span>Recommended Questions ({displayRecs.length})</span>
          </button>
        </div>
      )}

      {/* Mobile Recommended Questions Modal */}
      {isMobile && showMobileRecs && (
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="#1E3A8A" />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase' }}>
                  RECOMMENDED FOR YOU ({displayRecs.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileRecs(false)}
                className="touch-target center-content"
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 4 }}
                aria-label="Close recommendations"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayRecs.map((rec, idx) => (
                <div
                  key={rec.question_id || idx}
                  onClick={() => {
                    handleSelectRecommendation(rec);
                    setShowMobileRecs(false);
                  }}
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 0,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                    {rec.topic_name || rec.section_code || gSubject || 'PYQ'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#172033', lineHeight: 1.35 }}>
                    {rec.text ? (rec.text.length > 80 ? `${rec.text.substring(0, 80)}...` : rec.text) : `Practice Question ${idx + 1}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Container */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          paddingBottom: 28,
          paddingRight: isMobile ? 12 : 24,
          paddingLeft: isMobile ? 12 : 0,
          overflow: 'visible',
          position: 'relative',
          backgroundColor: '#F8FAF8',
          boxSizing: 'border-box',
          minHeight: 'calc(100vh - 180px)',
          gap: isMobile ? 0 : 20,
        }}
      >
        {/* Left Recommended Floating Panel (Desktop) */}
        {!isMobile && (
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
              alignSelf: 'flex-start',
              position: 'sticky',
              top: 12,
              maxHeight: 'calc(100vh - 200px)',
              marginLeft: 24,
              marginTop: 12,
              marginBottom: 28,
              boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.03)',
            }}
          >
            {/* Header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 0, backgroundColor: '#1E3A8A' }} />
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#1E3A8A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    RECOMMENDED FOR YOU
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', backgroundColor: '#F1F5F9', padding: '1px 6px', borderRadius: 0 }}>
                  {displayRecs.length} Qs
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: '#64748B', margin: 0, lineHeight: 1.35 }}>
                Matched questions for {gSubject || 'your focus area'}.
              </p>
            </div>

            {/* Stacked Dynamic Recommendation Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayRecs.length === 0 ? (
                <div style={{ fontSize: 11.5, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>
                  Loading recommendations...
                </div>
              ) : (
                displayRecs.map((rec, idx) => {
                  return (
                    <div
                      key={rec.question_id || idx}
                      onClick={() => handleSelectRecommendation(rec)}
                      style={{
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: 0,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                        e.currentTarget.style.borderColor = '#CBD5E1';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                        e.currentTarget.style.borderColor = '#E2E8F0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                          {rec.topic_name || rec.section_code || gSubject || 'PYQ'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#172033', lineHeight: 1.3 }}>
                        {rec.text ? (rec.text.length > 70 ? `${rec.text.substring(0, 70)}...` : rec.text) : `Practice Question ${idx + 1}`}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

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
          onSelectOption={(optId, optLbl) => handleSelectOption(optId, optLbl)}
          onToggleBookmark={() => setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }))}
          onRevealAnswer={() => handleRevealAnswer()}
          onShowSolution={() => handleShowSolution()}
          onPrev={() => currentQIndex > 0 && handleSelectQuestion(currentQIndex - 1)}
          onNext={() => currentQIndex < totalQuestions - 1 && handleSelectQuestion(currentQIndex + 1)}
        />
      </div>

      {/* Floating 10-Second Post-Exam Countdown Banner */}
      {scoreCountdown !== null && (
        <div
          style={{
            position: 'fixed',
            bottom: 74,
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
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
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
            <span>Test Finished! Showing score report in {scoreCountdown}s...</span>
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
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#C1121F';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#E31B23';
            }}
          >
            View Score Now &rsaquo;
          </button>
        </div>
      )}

      {/* Completion Score & Account Upsell Modal */}
      <GuestScoreModal
        isOpen={showScoreModal}
        scoreData={guestScoreData}
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
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              padding: '28px 28px',
              border: '2px solid #E2E8F0',
              boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
              textAlign: 'center',
              fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 0,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto',
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 800 }}>!</span>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#172033', margin: '0 0 8px 0' }}>
              Leave Practice Session?
            </h3>

            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 22px 0' }}>
              Your current test progress is temporarily cached in your browser. You can return anytime or start fresh.
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                Continue Practice
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  navigate('/');
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#B91C1C';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#DC2626';
                }}
              >
                Leave Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Question Limit Reached / Log In Modal */}
      {showLoginModal && (
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
                backgroundColor: '#F8FAFC',
                border: '1px solid #BFDBFE',
                color: '#1E3A8A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <Sparkles size={26} color="#1E3A8A" />
            </div>

            <div style={{ display: 'inline-block', backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 0, marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Guest Limit Reached (10 Questions)
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#172033', margin: '0 0 10px 0', lineHeight: 1.3 }}>
              Log in to Unlock More Questions
            </h3>

            <p style={{ fontSize: 13.5, color: '#64748B', lineHeight: 1.5, margin: '0 0 24px 0' }}>
              You've experienced your 10 free practice questions limit for guest users. Log in or create your free account to access 10,000+ PYQs, subtopic filters, detailed explanations, and unlimited test series!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  navigate('/login');
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
                <GraduationCap size={18} color="#FFFFFF" />
                Log In / Sign Up Now &rsaquo;
              </button>

              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
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
                Review Current 10 Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
