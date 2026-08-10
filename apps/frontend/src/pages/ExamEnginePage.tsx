import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExamHeader } from '../components/exam/ExamHeader';
import { ExamSectionSidebar, Section, Question } from '../components/exam/ExamSectionSidebar';
import { ExamQuestionCard } from '../components/exam/ExamQuestionCard';
import { ExamQuestionPalette } from '../components/exam/ExamQuestionPalette';
import { ExamFooterBar } from '../components/exam/ExamFooterBar';
import { ExamSubmitModal } from '../components/exam/ExamSubmitModal';
import { FileText, Layers, Grid } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function ExamEnginePage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ─── State Management ────────────────────────────────────────────────────────
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [bookmarkedQs, setBookmarkedQs] = useState<Record<number, boolean>>({});
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [timeLeft, setTimeLeft] = useState(7200); // 2 hours
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'answered' | 'marked' | 'unanswered'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Mobile Responsiveness State
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [mobileTab, setMobileTab] = useState<'question' | 'sections' | 'palette'>('question');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Live Timer Countdown Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Sections & Questions Data ───────────────────────────────────────────────
  const sections: Section[] = [
    { id: 'polity', label: 'Indian Polity', total: 10 },
    { id: 'economy', label: 'Indian Economy', total: 8 },
    { id: 'history', label: 'History & Culture', total: 7 },
    { id: 'geography', label: 'Geography & Environment', total: 8 },
  ];

  const questions: Question[] = [
    {
      id: 1,
      sectionId: 'polity',
      sectionName: 'Indian Polity',
      difficulty: 'Medium',
      text: 'Which of the following Fundamental Duties was added to the Constitution of India by the 42nd Constitutional Amendment Act, 1976?',
      textHindi: 'निम्नलिखित में से कौन सा मौलिक कर्तव्य 42वें संविधान संशोधन अधिनियम, 1976 द्वारा भारत के संविधान में जोड़ा गया था?',
      options: [
        { label: 'A', text: 'To abide by the Constitution and respect its ideals and institutions', textHindi: 'संविधान का पालन करना और उसके आदर्शों और संस्थानों का सम्मान करना' },
        { label: 'B', text: 'To develop scientific temper, humanism and the spirit of inquiry and reform', textHindi: 'वैज्ञानिक दृष्टिकोण, मानववाद और ज्ञानार्जन तथा सुधार की भावना का विकास करना' },
        { label: 'C', text: 'To provide opportunities for education to one\'s child between six and fourteen years', textHindi: 'छह से चौदह वर्ष की आयु के अपने बच्चे को शिक्षा के अवसर प्रदान करना' },
        { label: 'D', text: 'To cast vote in general elections without fear or favor', textHindi: 'बिना किसी भय या पक्षपात के आम चुनावों में मतदान करना' }
      ]
    },
    {
      id: 2,
      sectionId: 'polity',
      sectionName: 'Indian Polity',
      difficulty: 'Hard',
      text: 'The concept of "Basic Structure" of the Constitution of India was propounded by the Supreme Court in which landmark case?',
      textHindi: 'भारत के संविधान की "मूल संरचना" की अवधारणा को सर्वोच्च न्यायालय ने किस ऐतिहासिक मामले में प्रतिपादित किया था?',
      options: [
        { label: 'A', text: 'A.K. Gopalan v. State of Madras (1950)', textHindi: 'ए.के. गोपालन बनाम मद्रास राज्य (1950)' },
        { label: 'B', text: 'Golaknath v. State of Punjab (1967)', textHindi: 'गोलकनाथ बनाम पंजाब राज्य (1967)' },
        { label: 'C', text: 'Kesavananda Bharati v. State of Kerala (1973)', textHindi: 'केशवानंद भारती बनाम केरल राज्य (1973)' },
        { label: 'D', text: 'Minerva Mills v. Union of India (1980)', textHindi: 'मिनर्वा मिल कॉटन मिल्स बनाम भारत संघ (1980)' }
      ]
    },
    {
      id: 3,
      sectionId: 'economy',
      sectionName: 'Indian Economy',
      difficulty: 'Easy',
      text: 'Which body is responsible for formulating monetary policy in India to maintain price stability while keeping in mind the objective of growth?',
      textHindi: 'विकास के उद्देश्य को ध्यान में रखते हुए मूल्य स्थिरता बनाए रखने के लिए भारत में मौद्रिक नीति तैयार करने के लिए कौन सा निकाय जिम्मेदार है?',
      options: [
        { label: 'A', text: 'Ministry of Finance, Government of India', textHindi: 'वित्त मंत्रालय, भारत सरकार' },
        { label: 'B', text: 'Monetary Policy Committee (MPC) of the Reserve Bank of India', textHindi: 'भारतीय रिजर्व बैंक की मौद्रिक नीति समिति (MPC)' },
        { label: 'C', text: 'NITI Aayog Governing Council', textHindi: 'नीति आयोग गवर्निंग काउंसिल' },
        { label: 'D', text: 'Securities and Exchange Board of India (SEBI)', textHindi: 'भारतीय प्रतिभूति और विनिमय बोर्ड (SEBI)' }
      ]
    },
    {
      id: 4,
      sectionId: 'history',
      sectionName: 'History & Culture',
      difficulty: 'Medium',
      text: 'With reference to Ancient Indian History, the term "Sreni" referred to:',
      textHindi: 'प्राचीन भारतीय इतिहास के संदर्भ में, "श्रेणी" शब्द का तात्पर्य था:',
      options: [
        { label: 'A', text: 'An association of merchants and artisans', textHindi: 'व्यापारियों और कारीगरों का एक संगठन' },
        { label: 'B', text: 'The highest administrative officer in the Gupta administration', textHindi: 'गुप्त प्रशासन में सर्वोच्च प्रशासनिक अधिकारी' },
        { label: 'C', text: 'A category of land revenue collected during the Mauryan period', textHindi: 'मौर्य काल में एकत्र किए गए भू-राजस्व की एक श्रेणी' },
        { label: 'D', text: 'A military unit under the Chola empire', textHindi: 'चोल साम्राज्य के तहत एक सैन्य टुकड़ी' }
      ]
    },
    {
      id: 5,
      sectionId: 'geography',
      sectionName: 'Geography & Environment',
      difficulty: 'Hard',
      text: 'Consider the following statements regarding the Indian Ocean Dipole (IOD):\n1. Positive IOD phase is characterized by warmer sea surface temperatures in the western Indian Ocean.\n2. A positive IOD usually leads to a weaker Indian summer monsoon.\nWhich of the statements given above is/are correct?',
      textHindi: 'भारतीय महासागर द्विध्रुव (IOD) के संबंध में निम्नलिखित कथनों पर विचार करें:\n1. सकारात्मक IOD चरण की विशेषता पश्चिमी हिंद महासागर में समुद्र की सतह का अधिक गर्म तापमान है।\n2. एक सकारात्मक IOD आमतौर पर कमजोर भारतीय ग्रीष्मकालीन मानसून की ओर जाता है।\nउपरोक्त दिए गए कथनों में से कौन सा/से सही है/हैं?',
      options: [
        { label: 'A', text: '1 only', textHindi: 'केवल 1' },
        { label: 'B', text: '2 only', textHindi: 'केवल 2' },
        { label: 'C', text: 'Both 1 and 2', textHindi: '1 और 2 दोनों' },
        { label: 'D', text: 'Neither 1 nor 2', textHindi: 'न तो 1 और न ही 2' }
      ]
    }
  ];

  const currentQ = questions[currentQIndex];

  // Action handlers
  const handleSelectOption = (label: string) => {
    setSelectedOptions((prev) => ({ ...prev, [currentQIndex]: label }));
  };

  const handleClearResponse = () => {
    setSelectedOptions((prev) => {
      const copy = { ...prev };
      delete copy[currentQIndex];
      return copy;
    });
  };

  const handleToggleMarkReview = () => {
    setMarkedForReview((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }));
  };

  const handleToggleBookmark = () => {
    setBookmarkedQs((prev) => ({ ...prev, [currentQIndex]: !prev[currentQIndex] }));
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      if (isMobile) setMobileTab('question');
    }
  };

  const handlePrev = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex(currentQIndex - 1);
      if (isMobile) setMobileTab('question');
    }
  };

  const handleSelectSection = (sectionId: string) => {
    const firstQInSec = questions.findIndex((q) => q.sectionId === sectionId);
    if (firstQInSec !== -1) {
      setCurrentQIndex(firstQInSec);
      if (isMobile) setMobileTab('question');
    }
  };

  const handleSelectQuestionFromPalette = (idx: number) => {
    setCurrentQIndex(idx);
    if (isMobile) setMobileTab('question');
  };

  const answeredCount = Object.keys(selectedOptions).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = questions.length - answeredCount;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        overflowX: 'hidden'
      }}
    >
      {/* Top Header */}
      <ExamHeader
        examTitle="RankEdge PYQ Engine"
        paperSubtitle="UPSC CSE Prelims 2023 • GS Paper I"
        timeLeft={timeLeft}
        language={language}
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
            zIndex: 90
          }}
        >
          {[
            { id: 'question', label: 'Question', icon: FileText },
            { id: 'sections', label: 'Sections', icon: Layers },
            { id: 'palette', label: 'Palette', icon: Grid }
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
                  color: isActive ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748b'),
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
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
          overflow: 'hidden'
        }}
      >
        {/* Left: Section Sidebar (Show on Desktop or Mobile 'sections' tab) */}
        {(!isMobile || mobileTab === 'sections') && (
          <div style={{ width: isMobile ? '100%' : 240, height: '100%' }}>
            <ExamSectionSidebar
              sections={sections}
              activeSectionId={currentQ.sectionId}
              questions={questions}
              selectedOptions={selectedOptions}
              markedForReview={markedForReview}
              onSelectSection={handleSelectSection}
            />
          </div>
        )}

        {/* Center: Question Card (Show on Desktop or Mobile 'question' tab) */}
        {(!isMobile || mobileTab === 'question') && (
          <ExamQuestionCard
            question={currentQ}
            questionIndex={currentQIndex}
            totalQuestions={questions.length}
            selectedOption={selectedOptions[currentQIndex]}
            isBookmarked={!!bookmarkedQs[currentQIndex]}
            language={language}
            onSelectOption={handleSelectOption}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {/* Right: Question Palette (Show on Desktop or Mobile 'palette' tab) */}
        {(!isMobile || mobileTab === 'palette') && (
          <div style={{ width: isMobile ? '100%' : 300, height: '100%' }}>
            <ExamQuestionPalette
              questions={questions}
              currentQIndex={currentQIndex}
              selectedOptions={selectedOptions}
              markedForReview={markedForReview}
              paletteFilter={paletteFilter}
              onSelectQuestion={handleSelectQuestionFromPalette}
              onFilterChange={setPaletteFilter}
            />
          </div>
        )}
      </div>

      {/* Sticky Bottom Control Bar */}
      <ExamFooterBar
        isAnswered={selectedOptions[currentQIndex] !== undefined}
        isMarkedForReview={!!markedForReview[currentQIndex]}
        isFirstQuestion={currentQIndex === 0}
        onClearResponse={handleClearResponse}
        onToggleMarkReview={handleToggleMarkReview}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {/* Submit Confirmation Modal */}
      <ExamSubmitModal
        isOpen={showSubmitModal}
        answeredCount={answeredCount}
        markedCount={markedCount}
        unattemptedCount={unattemptedCount}
        onResume={() => setShowSubmitModal(false)}
        onConfirmSubmit={() => {
          setShowSubmitModal(false);
          navigate('/analytics');
        }}
      />
    </div>
  );
}
