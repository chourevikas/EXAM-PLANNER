import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamSectionSidebar } from '../components/exam/ExamSectionSidebar';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { ExamQuestionPalette } from '../components/exam/ExamQuestionPalette';
import { ExamFooterBar } from '../components/exam/ExamFooterBar';
import { GuestScoreModal } from '../components/exam/GuestScoreModal';
import { ExamLoaderOverlay } from '../components/exam/ExamLoaderOverlay';
import { Loader2 } from 'lucide-react';
import { QuestionOut, QuestionPaletteItem, RevealAnswerResponse } from '../types/exam';

export function GuestExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL Params
  const gExam = searchParams.get('exam') || 'UPSC CSE';
  const gYear = searchParams.get('year') || 'Target 2026';
  const gTopic = searchParams.get('topic') || 'Indian Polity & Governance';
  const gSubtopic = searchParams.get('subtopic') || 'Fundamental Rights';
  const gCount = parseInt(searchParams.get('count') || '10', 10);

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

  // Mobile Responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const SESSION_KEY = `guest_exam_session_${gExam}_${gYear}_${gTopic}_${gSubtopic}_${gCount}`;

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

        const expText = q.explanation || q.explanation_text || q.description || '';

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

      // Query DB directly for questions mapped to the subtopic/topic without artificial limit
      const params = new URLSearchParams({ limit: '100', include_solutions: 'true' });
      
      const cleanSub = gSubtopic && gSubtopic !== 'All Subtopics' && gSubtopic !== 'Choose Subtopic' ? gSubtopic.trim() : '';
      const cleanTop = gTopic && gTopic !== 'All Topics' && gTopic !== 'Choose Topic' ? gTopic.trim() : '';

      if (cleanSub) {
        params.append('subtopic_name', cleanSub);
      } else if (cleanTop) {
        params.append('topic_name', cleanTop);
      }

      if (gExam && gExam.toLowerCase().includes('upsc')) {
        params.append('exam_name', 'upsc');
      }

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
        console.warn('DB questions fetch warning:', err);
      }

      const fetchedList = Array.from(fetchedMap.values());
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
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write guest sessionStorage:', err);
    }
  }, [userResponses, revealedMap, markedForReview, bookmarkedQs, currentQIndex, isLoading, allQuestions]);

  // Switch Question
  const handleSelectQuestion = (idx: number) => {
    if (idx < 0 || idx >= allQuestions.length) return;
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

  // Reveal Instant Per-Question Answer & Description
  const handleRevealAnswer = (qId?: string) => {
    const targetId = qId || activeQuestion?.question_id;
    if (!targetId) return;

    const targetQuestion = allQuestions.find((q) => q.question_id === targetId) || activeQuestion;
    if (!targetQuestion) return;

    const userResp = userResponses[targetId];
    const correctOpt = targetQuestion.options?.find((o) => o.is_correct) || targetQuestion.options?.[0];
    const correctLabel = correctOpt?.option_label || 'A';
    const isUserCorrect = userResp ? (userResp.optionId === correctOpt?.option_id || userResp.optionLabel === correctLabel) : false;

    const expText = (targetQuestion as any).explanation ||
      (targetQuestion as any).description ||
      (targetQuestion as any).explanation_text ||
      '';

    const revealObj: RevealAnswerResponse = {
      question_id: targetId,
      question_number: targetQuestion.question_number,
      correct_option_id: correctOpt?.option_id || '',
      correct_option_label: correctLabel,
      is_user_correct: isUserCorrect,
      user_selected_option_id: userResp?.optionId || null,
      user_selected_label: userResp?.optionLabel || null,
      marks_awarded: isUserCorrect ? (targetQuestion.marks || 2.0) : -(targetQuestion.negative_marks || 0.66),
      closeness_score: isUserCorrect ? 100 : 0,
      closeness_classification: isUserCorrect ? 'EXACT' : 'INCORRECT',
      explanation: expText,
      distractor_scores: {},
    };

    setRevealedMap((prev) => ({
      ...prev,
      [targetId]: revealObj,
    }));

    // Update palette question_status on Submit & Show Solution
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

  if (allQuestions.length === 0 || !activeQuestion) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: '#F8FAFC', padding: 24, textAlign: 'center' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '40px 32px', maxWidth: 480, boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>No Real Questions Found</h2>
          <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 1.5 }}>
            No real questions mapped to <strong>{gSubtopic && gSubtopic !== 'Choose Subtopic' ? gSubtopic : gTopic}</strong> were found in the database.
          </p>
          <button
            onClick={() => navigate('/')}
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
            Choose Another Topic / Subtopic
          </button>
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
        backgroundColor: '#F8FAFC',
      }}
    >
      {/* Top Admin Theme Header */}
      <ExamHeader
        examTitle={gExam}
        paperSubtitle={`${gExam} · ${gYear} · ${gSubtopic}`}
        timeLeft={timeLeft}
        language={language}
        showSubmitButton={false}
        onLanguageChange={(lang) => setLanguage(lang)}
      />

      {/* Slide-out Drawer Left Sidebar */}
      <ExamSectionSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sections={[{ id: 'guest-sec-1', label: gTopic, total: allQuestions.length, startQuestionNumber: 1, endQuestionNumber: allQuestions.length }]}
        activeSectionId="guest-sec-1"
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

      {/* Main Console Workspace */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          marginTop: 60,
          marginBottom: 64,
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
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Right Question Palette */}
        {!isMobile && (
          <ExamQuestionPalette
            questions={allQuestions}
            palette={palette}
            currentQIndex={currentQIndex}
            selectedOptions={selectedOptionsMap}
            markedForReview={markedForReviewMap}
            paletteFilter={paletteFilter}
            onSelectQuestion={(idx) => handleSelectQuestion(idx)}
            onFilterChange={(f) => setPaletteFilter(f)}
          />
        )}
      </div>

      {/* Fixed Bottom Exam Control Bar */}
      <ExamFooterBar
        isAnswered={isCurrentAnswered}
        isMarkedForReview={isCurrentMarked}
        isFirstQuestion={currentQIndex === 0}
        isLastQuestion={currentQIndex >= totalQuestions - 1}
        isRevealed={!!currentRevealedResult}
        onClearResponse={handleClearResponse}
        onToggleMarkReview={handleToggleMarkReview}
        onSubmitAnswer={() => handleRevealAnswer()}
        onPrev={() => handleSelectQuestion(currentQIndex - 1)}
        onNext={() => {
          if (currentQIndex < totalQuestions - 1) {
            handleSelectQuestion(currentQIndex + 1);
          }
        }}
      />
    </div>
  );
}
