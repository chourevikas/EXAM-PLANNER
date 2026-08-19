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
import { QuestionOut, QuestionPaletteItem } from '../types/exam';

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
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});
  const [palette, setPalette] = useState<QuestionPaletteItem[]>([]);

  // Guest Score Modal
  const [showGuestScoreModal, setShowGuestScoreModal] = useState(false);
  const [guestScoreData, setGuestScoreData] = useState<any>(null);

  // Mobile Responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

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

  // Fetch Guest Questions with Fallback Enrichment for Full Target Count
  useEffect(() => {
    async function loadGuestQuestions() {
      setIsLoading(true);

      const targetCount = Math.max(1, gCount);
      const fetchedMap = new Map<string, any>();

      const formatQuestion = (q: any, idx: number): QuestionOut => ({
        question_id: q.question_id || `q-guest-${idx + 1}`,
        question_number: idx + 1,
        text: q.question_text || q.text || `Question #${idx + 1}`,
        options: (q.options || []).map((o: any, oIdx: number) => ({
          option_id: o.option_id || `opt-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
          option_label: o.option_label || String.fromCharCode(65 + oIdx),
          text: o.option_text || o.text || `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
          is_correct: Boolean(o.is_correct),
        })),
        section_code: q.topic_name || q.subject_name || gTopic || 'General Studies',
        topic_name: q.topic_name || gTopic,
        subtopic_name: q.subtopic_name || gSubtopic,
        difficulty: q.difficulty || 'MEDIUM',
        marks: q.marks || 2.0,
        negative_marks: q.negative_marks || 0.66,
        expected_time_seconds: q.expected_time_seconds || 60,
      });

      // Pass 1: Strict filters
      const p1 = new URLSearchParams({ limit: targetCount.toString() });
      if (gTopic && gTopic !== 'All Topics') p1.append('topic_name', gTopic);
      if (gSubtopic && gSubtopic !== 'All Subtopics') p1.append('subtopic_name', gSubtopic);
      if (gYear && gYear !== 'All Years (2018 - 2024)' && !isNaN(Number(gYear))) p1.append('exam_year', gYear);
      if (gExam && gExam.toLowerCase().includes('upsc')) p1.append('exam_name', 'upsc');

      try {
        const res1 = await fetch(`/api/v1/questions?${p1.toString()}`);
        if (res1.ok) {
          const data1 = await res1.json();
          (data1.items || []).forEach((item: any) => {
            if (item.question_id && !fetchedMap.has(item.question_id)) {
              fetchedMap.set(item.question_id, item);
            }
          });
        }
      } catch (err) {
        console.warn('P1 questions fetch warning:', err);
      }

      // Pass 2: Relax year filter if needed
      if (fetchedMap.size < targetCount) {
        const p2 = new URLSearchParams({ limit: targetCount.toString() });
        if (gTopic && gTopic !== 'All Topics') p2.append('topic_name', gTopic);
        if (gSubtopic && gSubtopic !== 'All Subtopics') p2.append('subtopic_name', gSubtopic);
        if (gExam && gExam.toLowerCase().includes('upsc')) p2.append('exam_name', 'upsc');

        try {
          const res2 = await fetch(`/api/v1/questions?${p2.toString()}`);
          if (res2.ok) {
            const data2 = await res2.json();
            (data2.items || []).forEach((item: any) => {
              if (item.question_id && !fetchedMap.has(item.question_id)) {
                fetchedMap.set(item.question_id, item);
              }
            });
          }
        } catch (err) {
          console.warn('P2 questions fetch warning:', err);
        }
      }

      // Pass 3: Relax subtopic filter if needed
      if (fetchedMap.size < targetCount) {
        const p3 = new URLSearchParams({ limit: targetCount.toString() });
        if (gTopic && gTopic !== 'All Topics') p3.append('topic_name', gTopic);
        if (gExam && gExam.toLowerCase().includes('upsc')) p3.append('exam_name', 'upsc');

        try {
          const res3 = await fetch(`/api/v1/questions?${p3.toString()}`);
          if (res3.ok) {
            const data3 = await res3.json();
            (data3.items || []).forEach((item: any) => {
              if (item.question_id && !fetchedMap.has(item.question_id)) {
                fetchedMap.set(item.question_id, item);
              }
            });
          }
        } catch (err) {
          console.warn('P3 questions fetch warning:', err);
        }
      }

      // Pass 4: General pool if still needed
      if (fetchedMap.size < targetCount) {
        try {
          const res4 = await fetch(`/api/v1/questions?limit=${targetCount}`);
          if (res4.ok) {
            const data4 = await res4.json();
            (data4.items || []).forEach((item: any) => {
              if (item.question_id && !fetchedMap.has(item.question_id)) {
                fetchedMap.set(item.question_id, item);
              }
            });
          }
        } catch (err) {
          console.warn('P4 questions fetch warning:', err);
        }
      }

      const fetchedList = Array.from(fetchedMap.values());
      const questionsList: QuestionOut[] = fetchedList.map((item, idx) => formatQuestion(item, idx));

      // Pass 5: Fallback padding if DB items total < targetCount
      while (questionsList.length < targetCount) {
        const qNum = questionsList.length + 1;
        questionsList.push({
          question_id: `guest-q-${qNum}`,
          question_number: qNum,
          text: `Which of the following statements regarding ${gSubtopic !== 'All Subtopics' ? gSubtopic : gTopic
            } under the Indian Constitution / Syllabus is correct?`,
          options: [
            { option_id: `g-opt-${qNum}-A`, option_label: 'A', text: `Statement I: It is guaranteed under Part III of the Constitution and enforceable by law.`, is_correct: true },
            { option_id: `g-opt-${qNum}-B`, option_label: 'B', text: `Statement II: It requires explicit legislative enactment for enforcement in all scenarios.`, is_correct: false },
            { option_id: `g-opt-${qNum}-C`, option_label: 'C', text: `Both Statement I and Statement II are incorrect.`, is_correct: false },
            { option_id: `g-opt-${qNum}-D`, option_label: 'D', text: `Neither Statement I nor Statement II applies to this subtopic.`, is_correct: false },
          ],
          section_code: gTopic,
          topic_name: gTopic,
          subtopic_name: gSubtopic,
          difficulty: qNum % 2 === 0 ? 'HARD' : 'MEDIUM',
          marks: 2.0,
          negative_marks: 0.66,
          expected_time_seconds: 60,
        });
      }

      setAllQuestions(questionsList);
      setTotalQuestions(questionsList.length);
      setActiveQuestion(questionsList[0]);

      const initialPalette: QuestionPaletteItem[] = questionsList.map((q, i) => ({
        question_number: i + 1,
        question_id: q.question_id,
        question_status: i === 0 ? 'VISITED' : ('UNVISITED' as any),
      }));
      setPalette(initialPalette);
      setIsLoading(false);
    }

    loadGuestQuestions();
  }, [gExam, gYear, gTopic, gSubtopic, gCount]);

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

    setPalette((prev) =>
      prev.map((item) => {
        if (item.question_id === qId) {
          const isMarked = markedForReview[qId];
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
          const isAns = !!userResponses[qId];
          if (nextMarked) {
            return { ...item, question_status: isAns ? ('ANSWERED_AND_MARKED' as any) : ('MARKED_FOR_REVIEW' as any) };
          }
          return { ...item, question_status: isAns ? ('ANSWERED' as any) : ('VISITED' as any) };
        }
        return item;
      })
    );
  };

  // Submit Test & Compute Scorecard
  const handleSubmitTest = () => {
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    allQuestions.forEach((q) => {
      const resp = userResponses[q.question_id];
      if (resp) {
        const matchedOption = q.options?.find((o: any) => o.option_id === resp.optionId || o.option_label === resp.optionLabel);
        if (matchedOption && matchedOption.is_correct) {
          score += q.marks || 2.0;
          correctCount += 1;
        } else {
          score -= q.negative_marks || 0.66;
          incorrectCount += 1;
        }
      } else {
        unattemptedCount += 1;
      }
    });

    const totalMarksPossible = allQuestions.reduce((acc, q) => acc + (q.marks || 2.0), 0);
    const accuracy = correctCount + incorrectCount > 0 ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0;

    setGuestScoreData({
      score: Math.max(0, Math.round(score * 100) / 100),
      totalMarksPossible,
      correctCount,
      incorrectCount,
      unattemptedCount,
      accuracy,
      totalQuestions: allQuestions.length,
      topicName: gTopic,
      subtopicName: gSubtopic,
      targetExam: gExam,
      targetYear: gYear,
    });

    setShowGuestScoreModal(true);
  };

  if (isLoading || !activeQuestion) {
    return (
      <ExamLoaderOverlay
        title="Preparing Mock Examination"
        subtitle="Structuring authentic PYQs and setting up your workspace..."
      />
    );
  }

  const currentResponse = userResponses[activeQuestion.question_id];
  const isCurrentAnswered = !!currentResponse;
  const isCurrentMarked = !!markedForReview[activeQuestion.question_id];

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

  const answeredCount = Object.keys(userResponses).length;
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
        examTitle="ExamPlanner PYQ Engine"
        paperSubtitle={`${gExam} · ${gYear} · ${gSubtopic}`}
        timeLeft={timeLeft}
        language={language}
        onLanguageChange={(lang) => setLanguage(lang)}
        onSubmitClick={handleSubmitTest}
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
          onSelectOption={(optId, optLbl) => handleSelectOption(optId, optLbl)}
          onToggleBookmark={() => setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }))}
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
        onClearResponse={handleClearResponse}
        onToggleMarkReview={handleToggleMarkReview}
        onPrev={() => handleSelectQuestion(currentQIndex - 1)}
        onNext={() => {
          if (currentQIndex < totalQuestions - 1) {
            handleSelectQuestion(currentQIndex + 1);
          } else {
            handleSubmitTest();
          }
        }}
      />

      {/* Guest Scorecard Modal */}
      {showGuestScoreModal && guestScoreData && (
        <GuestScoreModal
          isOpen={showGuestScoreModal}
          scoreData={guestScoreData}
          onClose={() => {
            setShowGuestScoreModal(false);
            navigate('/');
          }}
          onRetake={() => {
            setShowGuestScoreModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
