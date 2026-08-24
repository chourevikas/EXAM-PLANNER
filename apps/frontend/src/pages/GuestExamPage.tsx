import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { GuestScoreModal } from '../components/exam/GuestScoreModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { Loader2, AlertCircle, ArrowLeft, RotateCcw, Search, ChevronDown, ChevronRight, Check, SlidersHorizontal, Sparkles, GradCap } from 'lucide-react';
import { QuestionOut, QuestionPaletteItem, RevealAnswerResponse } from '../types/exam';
import { saveGuestAttempt } from '../utils/guestStorage';

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

  // Dynamic 3-level taxonomy fetched directly from DB / API
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [threeLevelHierarchy, setThreeLevelHierarchy] = useState<Record<string, Record<string, string[]>>>({});

  // Fetch dynamic taxonomy from DB endpoint (/api/v1/questions/taxonomy)
  useEffect(() => {
    async function fetchDBTaxonomy() {
      try {
        const res = await fetch('/api/v1/questions/taxonomy');
        if (res.ok) {
          const data = await res.json();
          if (data.subjects && Array.isArray(data.subjects)) {
            const cleanSubs = data.subjects.filter((s: string) => s !== 'All Subjects' && s.trim() !== '');
            if (cleanSubs.length > 0) {
              setSubjectsList(cleanSubs);
            }
          }
          if (data.hierarchy && typeof data.hierarchy === 'object') {
            setThreeLevelHierarchy(data.hierarchy);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch DB taxonomy:', err);
      }
    }
    fetchDBTaxonomy();
  }, []);

  // Dynamically mapped topics for selected subject (derived 100% from DB taxonomy)
  const availableTopics = useMemo(() => {
    const defaultList = ['All Topics'];
    const dbTopicMap = threeLevelHierarchy[gSubject];
    if (dbTopicMap && typeof dbTopicMap === 'object') {
      const dbTopics = Object.keys(dbTopicMap).filter((k) => k.trim() !== '' && !k.startsWith('All Topics'));
      if (dbTopics.length > 0) {
        return [...defaultList, ...dbTopics];
      }
    }
    return defaultList;
  }, [gSubject, threeLevelHierarchy]);

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
  const [guestScoreData, setGuestScoreData] = useState<any>(null);
  const [scoreCountdown, setScoreCountdown] = useState<number | null>(null);

  // Mobile Responsiveness & Custom Dropdown Search State
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');

  const SESSION_KEY = `guest_exam_session_${gExam}_${gYear}_${gSubject}_${gTopic}_${gSubtopic}_${gCount}`;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

      // 1. Try with full specificity (subject + topic + subtopic + year)
      const p1 = new URLSearchParams({ limit: gCount.toString() });
      if (gSubject && !gSubject.startsWith('All Subjects') && gSubject.trim()) {
        p1.append('subject_name', gSubject.trim());
      }
      if (gTopic && !gTopic.startsWith('All Topics') && gTopic.trim()) {
        p1.append('topic_name', gTopic.trim());
      }
      if (gSubtopic && !gSubtopic.startsWith('All Subtopics') && gSubtopic.trim()) {
        p1.append('subtopic_name', gSubtopic.trim());
      }
      const rawYearDigits = gYear.replace(/\D/g, '');
      if (rawYearDigits && !isNaN(Number(rawYearDigits)) && Number(rawYearDigits) >= 2000 && Number(rawYearDigits) <= 2024) {
        p1.append('exam_year', rawYearDigits);
      }
      if (gExam && gExam.toLowerCase().includes('upsc')) {
        p1.append('exam_name', 'upsc');
      }
      await fetchWithParams(p1);

      // 2. Fallback: Relax subtopic & year if 0 questions found
      if (fetchedMap.size === 0 && gTopic && !gTopic.startsWith('All Topics') && gTopic.trim()) {
        const p2 = new URLSearchParams({ limit: gCount.toString() });
        if (gSubject && !gSubject.startsWith('All Subjects') && gSubject.trim()) {
          p2.append('subject_name', gSubject.trim());
        }
        p2.append('topic_name', gTopic.trim());
        p2.append('exam_name', 'upsc');
        await fetchWithParams(p2);
      }

      // 3. Fallback: Relax topic if still 0 questions found
      if (fetchedMap.size === 0 && gSubject && !gSubject.startsWith('All Subjects') && gSubject.trim()) {
        const p3 = new URLSearchParams({ limit: gCount.toString() });
        p3.append('subject_name', gSubject.trim());
        p3.append('exam_name', 'upsc');
        await fetchWithParams(p3);
      }

      // 4. Fallback: General authentic UPSC questions pool
      if (fetchedMap.size === 0) {
        const p4 = new URLSearchParams({ limit: gCount.toString(), exam_name: 'upsc' });
        await fetchWithParams(p4);
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

    // If user hasn't selected an option yet, default to the first option so they can view the solution
    let userResp = userResponses[targetId];
    if (!userResp && targetQuestion.options && targetQuestion.options.length > 0) {
      const defaultOpt = targetQuestion.options[0];
      const defaultLabel = cleanOptionLabel(defaultOpt.option_label || '', 0);
      userResp = { optionId: defaultOpt.option_id, optionLabel: defaultLabel };
      setUserResponses((prev) => ({
        ...prev,
        [targetId]: userResp,
      }));
    }
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

    // Fetch rich solution metadata & distractor analyses
    let solPayload: any = null;
    try {
      const solRes = await fetch(`/api/v1/questions/${targetId}/solution`);
      if (solRes.ok) {
        solPayload = await solRes.json();
      }
    } catch (err) {
      console.warn('Failed to fetch full solution artifact:', err);
    }

    const expContent = solPayload?.explanation || (targetQuestion as any).explanation || `Option (${correctLabel}) is correct for this question on ${targetQuestion.topic_name || gTopic}.`;
    const distScores = solPayload?.distractor_scores || {};

    const revealObj: RevealAnswerResponse & { presigned_url?: string } = {
      question_id: targetId,
      question_number: targetQuestion.question_number,
      correct_option_id: solPayload?.correct_option_id || correctOpt?.option_id || '',
      correct_option_label: solPayload?.correct_option_label || correctLabel,
      is_user_correct: isUserCorrect,
      user_selected_option_id: userResp?.optionId || null,
      user_selected_label: userResp?.optionLabel || null,
      marks_awarded: isUserCorrect ? (targetQuestion.marks || 2.0) : -(targetQuestion.negative_marks || 0.66),
      closeness_score: isUserCorrect ? 1.0 : 0.0,
      closeness_classification: isUserCorrect ? 'Correct Response' : 'Incorrect Response',
      explanation: expContent,
      distractor_scores: distScores,
      presigned_url: solPayload?.presigned_url,
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

  const handleShowSolution = (passedRevealedMap?: Record<string, RevealAnswerResponse>) => {
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
            borderRadius: 16,
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
              borderRadius: '50%',
              backgroundColor: '#FEF3C7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#D97706',
              marginBottom: 16,
            }}
          >
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>
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
                borderRadius: 10,
                backgroundColor: '#2563EB',
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
                borderRadius: 10,
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
        color: '#0F172A',
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
              borderRadius: 9,
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 16,
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
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
              borderRadius: 6,
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
      {/* 2. Premium Floating Exam Filter Window (Below Navbar with generous spacing) */}
      <div
        style={{
          padding: '24px 28px 12px 28px',
          backgroundColor: 'transparent',
          zIndex: 40,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
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
              paddingRight: 16,
              borderRight: '1px solid #F1F5F9',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#EFF6FF',
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
                borderRadius: 9,
                border: activeDropdown === 'exam' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                backgroundColor: activeDropdown === 'exam' ? '#FFFFFF' : '#F8FAFC',
                color: '#0F172A',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: activeDropdown === 'exam' ? '0 0 0 3px rgba(30, 58, 138, 0.12)' : 'none',
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
                  borderRadius: 12,
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
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: gExam === opt ? 700 : 500,
                      color: gExam === opt ? '#1E3A8A' : '#334155',
                      backgroundColor: gExam === opt ? '#EFF6FF' : 'transparent',
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
                borderRadius: 9,
                border: activeDropdown === 'subject' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                backgroundColor: activeDropdown === 'subject' ? '#FFFFFF' : '#F8FAFC',
                color: '#0F172A',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: activeDropdown === 'subject' ? '0 0 0 3px rgba(30, 58, 138, 0.12)' : 'none',
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
                  borderRadius: 12,
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
                      borderRadius: 7,
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
                          borderRadius: 7,
                          fontSize: 12.5,
                          fontWeight: gSubject === opt ? 700 : 500,
                          color: gSubject === opt ? '#1E3A8A' : '#334155',
                          backgroundColor: gSubject === opt ? '#EFF6FF' : 'transparent',
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
                borderRadius: 9,
                border: activeDropdown === 'topic' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                backgroundColor: activeDropdown === 'topic' ? '#FFFFFF' : '#F8FAFC',
                color: '#0F172A',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: activeDropdown === 'topic' ? '0 0 0 3px rgba(30, 58, 138, 0.12)' : 'none',
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
                  borderRadius: 12,
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
                      borderRadius: 7,
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
                            borderRadius: 7,
                            fontSize: 12.5,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? '#1E3A8A' : '#334155',
                            backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
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
                borderRadius: 9,
                border: activeDropdown === 'difficulty' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                backgroundColor: activeDropdown === 'difficulty' ? '#FFFFFF' : '#F8FAFC',
                color: '#0F172A',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: activeDropdown === 'difficulty' ? '0 0 0 3px rgba(30, 58, 138, 0.12)' : 'none',
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
                  borderRadius: 12,
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
                        borderRadius: 7,
                        fontSize: 12.5,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#1E3A8A' : '#334155',
                        backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
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

      {/* 3. Main Workspace Container */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          paddingBottom: 28,
          paddingRight: 24,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#F8FAF8',
          boxSizing: 'border-box',
        }}
      >
        {/* Left Recommended Floating Panel */}
        {!isMobile && (
          <aside
            style={{
              width: 270,
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 18,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 14px',
              gap: 14,
              overflowY: 'auto',
              flexShrink: 0,
              height: 'calc(100% - 40px)',
              maxHeight: 'calc(100% - 40px)',
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
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#1E3A8A' }} />
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: '#1E3A8A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    RECOMMENDED FOR YOU
                  </span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', backgroundColor: '#F1F5F9', padding: '1px 6px', borderRadius: 8 }}>
                  5 Sets
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: '#64748B', margin: 0, lineHeight: 1.35 }}>
                Targeted PYQ sets matched with your focus area.
              </p>
            </div>

            {/* Stacked Recommendation Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Card 1 */}
              <div
                onClick={() => navigate(`/guest-exam?subject=Polity&topic=Fundamental%20Rights&count=10`)}
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
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
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>2020 - 2024 • Polity</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#1E3A8A', backgroundColor: '#EFF6FF', padding: '1px 5px', borderRadius: 4, border: '1px solid #DBEAFE' }}>
                    CROSS YEAR
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 4, lineHeight: 1.3 }}>
                  Fundamental Rights & Writs
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', lineHeight: 1.35 }}>
                  <strong style={{ fontWeight: 600, color: '#475569' }}>Why:</strong> 5 high-frequency questions.
                </div>
              </div>

              {/* Card 2 */}
              <div
                onClick={() => navigate(`/guest-exam?subject=History&topic=Modern%20History&count=10`)}
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
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
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>2021 - 2023 • History</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#92400E', backgroundColor: '#FEF3C7', padding: '1px 5px', borderRadius: 4, border: '1px solid #FDE68A' }}>
                    CHALLENGE
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 4, lineHeight: 1.3 }}>
                  Governor General Acts
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', lineHeight: 1.35 }}>
                  <strong style={{ fontWeight: 600, color: '#475569' }}>Why:</strong> 42% accuracy topic.
                </div>
              </div>

              {/* Card 3 */}
              <div
                onClick={() => navigate(`/guest-exam?subject=Economy&count=10`)}
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
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
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>2019 - 2024 • Economy</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#047857', backgroundColor: '#ECFDF5', padding: '1px 5px', borderRadius: 4, border: '1px solid #A7F3D0' }}>
                    HIGH YIELD
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 4, lineHeight: 1.3 }}>
                  Monetary Policy & Banking
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', lineHeight: 1.35 }}>
                  <strong style={{ fontWeight: 600, color: '#475569' }}>Why:</strong> High frequency conceptual tests.
                </div>
              </div>

              {/* Card 4 */}
              <div
                onClick={() => navigate(`/guest-exam?subject=Environment&count=10`)}
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
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
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>2018 - 2024 • Environment</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#4338CA', backgroundColor: '#EEF2FF', padding: '1px 5px', borderRadius: 4, border: '1px solid #C7D2FE' }}>
                    BIODIVERSITY
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 4, lineHeight: 1.3 }}>
                  Western Ghats & Conservation
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', lineHeight: 1.35 }}>
                  <strong style={{ fontWeight: 600, color: '#475569' }}>Why:</strong> Frequently asked species & hotspot trends.
                </div>
              </div>

              {/* Card 5 */}
              <div
                onClick={() => navigate(`/guest-exam?subject=Geography&count=10`)}
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
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
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>2020 - 2024 • Geography</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#0D9488', backgroundColor: '#F0FDFA', padding: '1px 5px', borderRadius: 4, border: '1px solid #99F6E4' }}>
                    MAP BASED
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 4, lineHeight: 1.3 }}>
                  River Systems & Drainage
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', lineHeight: 1.35 }}>
                  <strong style={{ fontWeight: 600, color: '#475569' }}>Why:</strong> High frequency map-based questions.
                </div>
              </div>
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
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            borderRadius: 99,
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
                borderRadius: '50%',
                backgroundColor: '#2563EB',
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
              borderRadius: 20,
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1D4ED8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2563EB';
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
              borderRadius: 20,
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
                borderRadius: '50%',
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

            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
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
                  borderRadius: 12,
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
                  borderRadius: 12,
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
    </div>
  );
}
