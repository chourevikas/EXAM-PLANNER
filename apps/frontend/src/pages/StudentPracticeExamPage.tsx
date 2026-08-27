import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, ChevronDown, Check, Search } from 'lucide-react';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamSectionSidebar } from '../components/exam/ExamSectionSidebar';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { GuestScoreModal } from '../components/exam/GuestScoreModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { QuestionOut, QuestionPaletteItem, RevealAnswerResponse } from '../types/exam';
import { saveGuestAttempt } from '../utils/guestStorage';
import { fetchMasterSyllabus, verifySyllabusNode, listExams } from '../services/examService';

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
  const [activeDropdown, setActiveDropdown] = useState<'exam' | 'subject' | 'topic' | 'difficulty' | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');

  // Master Syllabus Taxonomy & Available Exams state fetched directly from live APIs
  const [masterSyllabus, setMasterSyllabus] = useState<any>(null);
  const [availableExams, setAvailableExams] = useState<string[]>([]);

  // Session State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(gCount);
  const [timeLeft, setTimeLeft] = useState(600); // Exactly 10 mins (600s)
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'marked' | 'unanswered'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Collapsible Left Drawer State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Question & Response Data
  const [allQuestions, setAllQuestions] = useState<QuestionOut[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuestionOut | null>(null);
  const [userResponses, setUserResponses] = useState<Record<string, { optionId: string; optionLabel: string }>>({});
  const [revealedMap, setRevealedMap] = useState<Record<string, RevealAnswerResponse>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});
  const [palette, setPalette] = useState<QuestionPaletteItem[]>([]);

  // Modal & Popup States
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [guestScoreData, setGuestScoreData] = useState<any>(null);
  const [scoreCountdown, setScoreCountdown] = useState<number | null>(null);

  // Mobile Responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const SESSION_KEY = `student_practice_session_${gExam}_${gYear}_${gSubject}_${gTopic}_${gSubtopic}_${gCount}`;

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
          const names = Array.from(new Set(eList.map((e: any) => e.title || e.exam_name || e.code).filter(Boolean)));
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
        }));

        const expText = q.explanation || q.explanation_text || q.description || q.solution || q.solution_text || '';

        return {
          question_id: q.question_id || `q-practice-${idx + 1}`,
          question_number: idx + 1,
          text: q.question_text || q.text || '',
          options: optionsList,
          section_code: q.subtopic_name || q.topic_name || q.subject_name || gSubject || '',
          topic_name: q.topic_name || gTopic,
          subtopic_name: q.subtopic_name || gSubtopic,
          difficulty: q.difficulty || 'MEDIUM',
          marks: q.marks || 2.0,
          negative_marks: q.negative_marks || 0.66,
          expected_time_seconds: q.expected_time_seconds || 60,
          explanation: expText,
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


      // Extract numeric exam year if present
      let numericYear: string | null = null;
      if (gYear) {
        const match = gYear.match(/\b(19\d\d|20\d\d)\b/);
        if (match) numericYear = match[1];
      }

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
          console.warn('Practice questions fetch error:', err);
        }
      };

      try {
        const targetExam = gExam ? (gExam.toLowerCase().includes('upsc') ? 'upsc' : gExam.toLowerCase().trim()) : '';

        // 1. Try with subject + topic + year + selected exam
        const p1 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
        if (reqSubject) p1.append('subject_name', reqSubject);
        if (reqTopic) p1.append('topic_name', reqTopic);
        if (numericYear) p1.append('exam_year', numericYear);
        if (targetExam) p1.append('exam_name', targetExam);

        await fetchWithParams(p1);

        // 2. Fallback: Relax year if 0 questions found for exact year (keep subject + topic)
        if (fetchedMap.size === 0 && reqTopic) {
          const p2 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          if (reqSubject) p2.append('subject_name', reqSubject);
          p2.append('topic_name', reqTopic);
          if (targetExam) p2.append('exam_name', targetExam);
          await fetchWithParams(p2);
        }

        // 3. Fallback: Relax topic to subject if still 0 questions found (keep subject)
        if (fetchedMap.size === 0 && reqSubject) {
          const p3 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          p3.append('subject_name', reqSubject);
          if (targetExam) p3.append('exam_name', targetExam);
          await fetchWithParams(p3);
        }

        // 4. Fallback: Try raw subject if canonical subject differed (keep subject)
        if (fetchedMap.size === 0 && rawSubject && rawSubject !== reqSubject) {
          const p4 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          p4.append('subject_name', rawSubject);
          if (targetExam) p4.append('exam_name', targetExam);
          await fetchWithParams(p4);
        }

        // 5. Fallback: Relax exam filter but strictly keep subject_name if user selected a subject
        if (fetchedMap.size === 0 && (reqSubject || rawSubject)) {
          const p5 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          p5.append('subject_name', reqSubject || rawSubject);
          await fetchWithParams(p5);
        }

        // 6. Fallback: Only if user explicitly chose "All Subjects" (no subject selected)
        if (fetchedMap.size === 0 && !rawSubject) {
          const p6 = new URLSearchParams({ limit: gCount.toString(), include_solutions: 'true' });
          if (targetExam) p6.append('exam_name', targetExam);
          await fetchWithParams(p6);
        }
      } catch (err) {
        console.warn('Practice questions fetch warning:', err);
      }

      let fetchedList = Array.from(fetchedMap.values());
      
      // Cap at user-selected question count
      if (fetchedList.length > gCount) {
        fetchedList = fetchedList.slice(0, gCount);
      }

      const questionsList: QuestionOut[] = fetchedList.map((item, idx) => formatQuestion(item, idx));

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
            if (typeof savedData.currentQIndex === 'number' && savedData.currentQIndex >= 0 && savedData.currentQIndex < questionsList.length) {
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
  }, [gExam, gYear, gTopic, gSubtopic, gCount]);

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
  }, [userResponses, revealedMap, markedForReview, bookmarkedQs, currentQIndex, timeLeft, isLoading, allQuestions]);

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
      })
    );
  };

  // Option selection
  const handleSelectOption = (optionId: string, optionLabel: string) => {
    if (!activeQuestion) return;
    const qId = activeQuestion.question_id;

    setUserResponses((prev) => ({
      ...prev,
      [qId]: { optionId, optionLabel },
    }));

    handleRevealAnswer(qId, optionId, optionLabel);
  };

  // Reveal Instant Per-Question Answer & Description with Full Solution
  const handleRevealAnswer = async (qId?: string, overrideOptId?: string, overrideOptLbl?: string) => {
    const targetId = qId || activeQuestion?.question_id;
    if (!targetId) return;

    const targetQuestion = allQuestions.find((q) => q.question_id === targetId) || activeQuestion;
    if (!targetQuestion) return;

    // If user hasn't selected an option yet, default to the first option so they can view the solution
    let userResp = overrideOptId ? { optionId: overrideOptId, optionLabel: overrideOptLbl || '' } : userResponses[targetId];
    if (!userResp && targetQuestion.options && targetQuestion.options.length > 0) {
      const defaultOpt = targetQuestion.options[0];
      const defaultLabel = cleanOptionLabel(defaultOpt.option_label || '', 0);
      userResp = { optionId: defaultOpt.option_id, optionLabel: defaultLabel };
      setUserResponses((prev) => ({
        ...prev,
        [targetId]: userResp!,
      }));
    }

    const correctOpt = targetQuestion.options?.find((o) => o.is_correct);

    let isUserCorrect = false;
    if (userResp && targetQuestion.options) {
      const selectedOpt = targetQuestion.options.find(
        (o, idx) => o.option_id === userResp!.optionId || cleanOptionLabel(o.option_label || '', idx) === userResp!.optionLabel
      );
      if (selectedOpt && selectedOpt.is_correct) {
        isUserCorrect = true;
      }
    }

    const correctOptIndex = targetQuestion.options?.findIndex((o) => o.is_correct) ?? 0;
    const correctLabel = correctOpt ? cleanOptionLabel(correctOpt.option_label || '', correctOptIndex) : 'A';

    // Fetch rich solution metadata & distractor analyses if available
    let solPayload: any = null;
    try {
      const solRes = await fetch(`/api/v1/questions/${targetId}/solution`);
      if (solRes.ok) {
        solPayload = await solRes.json();
      }
    } catch (err) {
      console.warn('Failed to fetch full solution artifact:', err);
    }

    const expContent = solPayload?.explanation || (targetQuestion as any).explanation || (targetQuestion as any).description || (targetQuestion as any).solution || (targetQuestion as any).solution_text || `Option (${correctLabel}) is correct.`;

    const revealObj: RevealAnswerResponse = {
      question_id: targetId,
      question_number: targetQuestion.question_number,
      correct_option_id: solPayload?.correct_option_id || correctOpt?.option_id || '',
      correct_option_label: solPayload?.correct_option_label || correctLabel,
      is_user_correct: isUserCorrect,
      user_selected_option_id: userResp?.optionId || null,
      user_selected_label: userResp?.optionLabel || null,
      marks_awarded: isUserCorrect ? (targetQuestion.marks || 2.0) : -(targetQuestion.negative_marks || 0.66),
      closeness_score: isUserCorrect ? 100 : 0,
      closeness_classification: isUserCorrect ? 'EXACT' : 'INCORRECT',
      explanation: expContent,
      distractor_scores: solPayload?.distractor_scores || {},
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
      })
    );

    // Check if ALL questions are finished (revealed)
    const numQuestions = allQuestions.length;
    if (Object.keys(updatedRevealedMap).length >= numQuestions && numQuestions > 0) {
      handleFinishPracticeExam(updatedRevealedMap);
    }
  };

  const handleShowSolution = (passedRevealedMap?: Record<string, RevealAnswerResponse>) => {
    const rMap = passedRevealedMap || revealedMap;
    const numQuestions = allQuestions.length;
    const isCompleted = Object.keys(rMap).length >= numQuestions || numQuestions === 1;
    if (isCompleted && scoreCountdown === null && !showScoreModal) {
      handleFinishPracticeExam(rMap);
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
      topicName: gTopic,
      subtopicName: gSubtopic,
      targetExam: gExam,
      targetYear: gYear,
      timeSpentSeconds: Math.max(30, 600 - timeLeft),
      responses: responsesPayload,
    };

    setGuestScoreData(scorePayload);
    saveGuestAttempt(scorePayload);
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

  // Dynamically extract subjects from API masterSyllabus tree and fetched questions
  const syllabusSubjects = masterSyllabus ? Object.keys(masterSyllabus) : [];
  const questionSubjects = Array.from(new Set(allQuestions.map((q) => q.section_code || (q as any).subject_name).filter(Boolean)));
  const combinedSubjects = Array.from(new Set([...syllabusSubjects, ...questionSubjects]));
  const subjectsList = ['All Subjects', ...combinedSubjects];

  // Dynamically extract topics from API masterSyllabus tree and fetched questions
  let dynamicTopics: string[] = [];
  if (gSubject && gSubject !== 'All Subjects' && masterSyllabus && masterSyllabus[gSubject]) {
    dynamicTopics = Object.keys(masterSyllabus[gSubject]);
  } else if (masterSyllabus) {
    Object.keys(masterSyllabus).forEach((sKey) => {
      if (masterSyllabus[sKey] && typeof masterSyllabus[sKey] === 'object') {
        dynamicTopics.push(...Object.keys(masterSyllabus[sKey]));
      }
    });
  }
  const qTopics = allQuestions.map((q) => q.topic_name).filter(Boolean) as string[];
  dynamicTopics = Array.from(new Set([...dynamicTopics, ...qTopics]));
  const availableTopics = ['All Topics', ...dynamicTopics];

  const selectedOptionsMap: Record<number, string> = {};
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: '#F8FAFC', padding: 24, textAlign: 'center' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '40px 32px', maxWidth: 480, boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>No Practice Questions Found</h2>
          <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 1.5 }}>
            No practice questions mapped to <strong>{gTopic || gSubject}</strong> were found.
          </p>
          <button
            onClick={() => navigate('/mocks')}
            style={{
              padding: '12px 24px',
              borderRadius: 9,
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
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
      />

      {/* Slide-out Drawer Left Sidebar */}
      <ExamSectionSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sections={[{ id: 'student-sec-1', label: gTopic || gSubject || 'General Studies', total: allQuestions.length, startQuestionNumber: 1, endQuestionNumber: allQuestions.length }]}
        activeSectionId="student-sec-1"
        palette={palette}
        totalQuestions={totalQuestions}
        currentQIndex={currentQIndex}
        responseSummary={{
          answered_count: answeredCount,
          marked_for_review_count: markedCount,
          unattempted_count: unattemptedCount,
          total: totalQuestions,
        }}
        selectedOptions={selectedOptionsMap}
        markedForReview={markedForReviewMap}
        onSelectSection={() => handleSelectQuestion(0)}
      />

      {/* Premium Floating Exam Filter Window (Same as Guest Exam Page) */}
      <div
        style={{
          marginTop: 64,
          padding: '16px 28px 8px 28px',
          backgroundColor: 'transparent',
          zIndex: 80,
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

          {/* Filter 1: Exam Target */}
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
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gExam || 'UPSC CSE'}</span>
              <ChevronDown size={14} color="#64748B" style={{ transform: activeDropdown === 'exam' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

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
                {(availableExams.length > 0 ? availableExams : ['UPSC CSE', 'State PSC']).map((opt) => (
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
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: gExam === opt ? 700 : 500,
                      color: gExam === opt ? '#1E3A8A' : '#334155',
                      backgroundColor: gExam === opt ? '#EFF6FF' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{opt}</span>
                    {gExam === opt && <Check size={14} color="#1E3A8A" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filter 2: Subject Focus */}
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
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gSubject || 'All Subjects'}</span>
              <ChevronDown size={14} color="#64748B" style={{ transform: activeDropdown === 'subject' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

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
                            const current = new URLSearchParams(searchParams);
                            if (opt === 'All Topics') current.delete('topic');
                            else current.set('topic', opt);
                            navigate(`/practice-exam?${current.toString()}`);
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
                        const current = new URLSearchParams(searchParams);
                        if (opt === 'All Levels') current.delete('difficulty');
                        else current.set('difficulty', opt);
                        navigate(`/practice-exam?${current.toString()}`);
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

      {/* Main Console Workspace */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          marginTop: 0,
          marginBottom: 0,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#F8FAFC',
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
          onSelectOption={(optId, optLbl) => handleSelectOption(optId, optLbl)}
          onToggleBookmark={() => setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }))}
          onRevealAnswer={() => handleRevealAnswer()}
          onShowSolution={() => handleShowSolution()}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onPrev={() => currentQIndex > 0 && handleSelectQuestion(currentQIndex - 1)}
          onNext={() => currentQIndex < totalQuestions - 1 && handleSelectQuestion(currentQIndex + 1)}
        />

      </div>

      {/* Floating 10-Second Post-Exam Countdown Banner */}
      {scoreCountdown !== null && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
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
              borderRadius: 20,
              padding: 32,
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
              border: '1px solid #E2E8F0',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
              Leave Practice Session?
            </h3>

            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 22px 0' }}>
              Your current practice progress is temporarily saved in your browser. You can return anytime.
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
              >
                Continue Practice
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  navigate('/dashboard');
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
