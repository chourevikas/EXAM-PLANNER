import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Layers, Target, Check, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { HeroIllustration } from './HeroIllustration';

interface HeroSectionProps {
  onSignup?: () => void;
  onLogin?: () => void;
}

// Supported Target Exams list
const TARGET_EXAM_OPTIONS = [
  'UPSC CSE',
];

// Target exam year options
const TARGET_YEAR_OPTIONS = [
  'All Years (2018 - 2024)',
  '2024 PYQs',
  '2023 PYQs',
  '2022 PYQs',
  '2021 PYQs',
  '2020 PYQs',
  '2019 PYQs',
  '2018 PYQs',
];

const QUESTION_COUNTS = [5, 10, 15, 20];

export function HeroSection({ }: HeroSectionProps) {
  const navigate = useNavigate();

  // Dynamic 3-level taxonomy state fetched directly from DB / API
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [threeLevelHierarchy, setThreeLevelHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [examsList] = useState<string[]>(TARGET_EXAM_OPTIONS);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState<boolean>(true);

  // Form selections (Subject is required, Topic & Subtopic are optional)
  const [selectedExam, setSelectedExam] = useState<string>('UPSC CSE');
  const [selectedYear, setSelectedYear] = useState<string>('All Years (2018 - 2024)');
  const [selectedSubject, setSelectedSubject] = useState<string>('Polity');
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics (Entire Subject)');
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>('All Subtopics (Entire Topic)');
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Fetch Dynamic 3-level Taxonomy from Backend API
  useEffect(() => {
    async function loadDynamicTaxonomy() {
      setIsTaxonomyLoading(true);
      try {
        const taxRes = await fetch('/api/v1/questions/taxonomy');
        if (taxRes.ok) {
          const taxData = await taxRes.json();
          if (taxData.subjects && Array.isArray(taxData.subjects)) {
            const cleanSubs = taxData.subjects.filter((s: string) => s !== 'All Subjects' && s.trim() !== '');
            if (cleanSubs.length > 0) {
              setSubjectsList(cleanSubs);
              const initialSubject = cleanSubs.includes('Polity') ? 'Polity' : cleanSubs[0];
              setSelectedSubject(initialSubject);
            }
          }
          if (taxData.hierarchy) {
            setThreeLevelHierarchy(taxData.hierarchy);
          }
        }
      } catch (err) {
        console.warn('Taxonomy DB fetch warning:', err);
      } finally {
        setIsTaxonomyLoading(false);
      }
    }

    loadDynamicTaxonomy();
  }, []);

  // Compute available topics for the chosen subject directly from DB taxonomy
  const availableTopics = useMemo(() => {
    const defaultList = ['All Topics (Entire Subject)'];
    const topicMap = threeLevelHierarchy[selectedSubject];
    if (topicMap && typeof topicMap === 'object') {
      const keys = Object.keys(topicMap).filter((k) => k.trim() !== '' && !k.startsWith('All Topics'));
      if (keys.length > 0) return [...defaultList, ...keys];
    }
    return defaultList;
  }, [selectedSubject, threeLevelHierarchy]);

  // Compute available subtopics for the chosen subject and topic directly from DB taxonomy
  const availableSubtopics = useMemo(() => {
    const defaultList = ['All Subtopics (Entire Topic)'];
    if (!selectedTopic || selectedTopic.startsWith('All Topics')) {
      return defaultList;
    }
    const rawSubs = threeLevelHierarchy[selectedSubject]?.[selectedTopic];
    if (Array.isArray(rawSubs) && rawSubs.length > 0) {
      const cleanSubs = rawSubs.filter((s) => !s.startsWith('All Subtopics') && s.trim() !== '');
      if (cleanSubs.length > 0) return [...defaultList, ...cleanSubs];
    }
    return defaultList;
  }, [selectedSubject, selectedTopic, threeLevelHierarchy]);

  const handleSubjectChange = (newSubject: string) => {
    setSelectedSubject(newSubject);
    setSelectedTopic('All Topics (Entire Subject)');
    setSelectedSubtopic('All Subtopics (Entire Topic)');
  };

  const handleTopicChange = (newTopic: string) => {
    setSelectedTopic(newTopic);
    setSelectedSubtopic('All Subtopics (Entire Topic)');
  };

  const handleSubtopicChange = (newSubtopic: string) => {
    setSelectedSubtopic(newSubtopic);
  };

  const handleStartGuestExam = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTopic = selectedTopic.startsWith('All Topics') ? '' : selectedTopic;
    const cleanSubtopic = selectedSubtopic.startsWith('All Subtopics') ? '' : selectedSubtopic;
    const cleanYear = selectedYear.startsWith('All Years') ? '' : (selectedYear.match(/\d{4}/)?.[0] || '');

    const queryParams = new URLSearchParams({
      exam: selectedExam,
      year: cleanYear,
      subject: selectedSubject,
      topic: cleanTopic,
      subtopic: cleanSubtopic,
      count: questionCount.toString(),
    });

    navigate(`/guest-exam?${queryParams.toString()}`);
  };

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#F8FAFC',
        paddingTop: '96px',
        paddingBottom: '48px',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Subtle background grid pattern */}
      <div
        className="dot-grid"
        style={{ position: 'absolute', inset: 0, opacity: 0.38, pointerEvents: 'none' }}
      />

      {/* Soft blue radial glow behind hero */}
      <div
        style={{
          position: 'absolute',
          top: '5%',
          left: '45%',
          transform: 'translateX(-50%)',
          width: 750,
          height: 400,
          background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.045) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="landing-container" style={{ position: 'relative', zIndex: 1 }}>
        <div
          className="hero-grid"
          style={{
            display: 'grid',
            alignItems: 'center',
            gap: 36,
          }}
        >
          {/* Left Column: Headline & Premium Builder Form Card */}
          <div style={{ maxWidth: 560 }}>
            {/* Eyebrow */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#EFF6FF',
                border: '1px solid #DBEAFE',
                borderRadius: 99,
                padding: '5px 12px',
                marginBottom: 14,
              }}
            >
              <Zap size={13} strokeWidth={2.5} style={{ color: '#2563EB' }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2563EB', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                INSTANT PYQ MOCK TEST
              </span>
            </div>

            {/* Main Heading */}
            <h1
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
                fontWeight: 800,
                color: '#0F172A',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                marginBottom: 20,
                position: 'relative',
                zIndex: 2,
                opacity: 1,
                visibility: 'visible',
                display: 'block',
              }}
            >
              Test your exam readiness. <br />
              <span style={{ color: '#2563EB', fontWeight: 800 }}>Start in 60 seconds.</span>
            </h1>

            {/* Premium Mock Builder Form Card */}
            <form
              onSubmit={handleStartGuestExam}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 14,
                padding: '24px 26px',
                boxShadow: '0 10px 28px -4px rgba(15, 23, 42, 0.05), 0 3px 10px -2px rgba(15, 23, 42, 0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Card Header */}
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 16.5, fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.25 }}>
                  Build your mock
                </h2>
                <p style={{ fontSize: 12.5, color: '#64748B', margin: '3px 0 0 0' }}>
                  Choose your exam focus and question count.
                </p>
              </div>

              {/* Form Row 1: Target exam & Target year */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                {/* Target exam Select */}
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0F172A',
                      marginBottom: 5,
                    }}
                  >
                    <BookOpen size={13} style={{ color: '#2563EB' }} /> Target exam
                  </label>
                  <select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 9,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: 13,
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563EB';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E2E8F0';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    {examsList.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target year Select */}
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0F172A',
                      marginBottom: 5,
                    }}
                  >
                    <Calendar size={13} style={{ color: '#2563EB' }} /> Target year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 9,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: 13,
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563EB';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E2E8F0';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    {TARGET_YEAR_OPTIONS.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Row 2: Subject & Topic */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                {/* Subject Select */}
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0F172A',
                      marginBottom: 5,
                    }}
                  >
                    <BookOpen size={13} style={{ color: '#2563EB' }} /> Subject
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 9,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: 13,
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {subjectsList.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Topic Select */}
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0F172A',
                      marginBottom: 5,
                    }}
                  >
                    <Layers size={13} style={{ color: '#2563EB' }} /> Topic
                  </label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 9,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: 13,
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {availableTopics.map((top) => (
                      <option key={top} value={top}>
                        {top}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Row 3: Subtopic & Primary CTA Button */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                  marginBottom: 14,
                }}
              >
                {/* Subtopic Select */}
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#0F172A',
                      marginBottom: 5,
                    }}
                  >
                    <Target size={13} style={{ color: '#2563EB' }} /> Subtopic
                  </label>
                  <select
                    value={selectedSubtopic}
                    onChange={(e) => handleSubtopicChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 9,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: 13,
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {availableSubtopics.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Free Mock CTA Button in empty right column beside Subtopic */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    style={{
                      width: '100%',
                      height: 38,
                      borderRadius: 9,
                      border: 'none',
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.22)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#1D4ED8';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.32)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#2563EB';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.22)';
                    }}
                  >
                    Start Free Mock
                    <ArrowRight size={16} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {/* Contextual Mock Summary Bar */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 9,
                  padding: '8px 12px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#64748B',
                }}
              >
                <span style={{ fontWeight: 600, color: '#0F172A' }}>Your practice session:</span>
                <span style={{ color: '#0F172A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSubject} · {selectedTopic} · {selectedSubtopic} ({questionCount} Qs)
                </span>
              </div>

              {/* Compact Trust / Benefit Row */}
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  fontSize: 12,
                  color: '#64748B',
                  fontWeight: 500,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} style={{ color: '#059669' }} /> Authentic PYQs
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={12.5} style={{ color: '#2563EB' }} /> Instant mock
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#64748B', display: 'inline-block' }} /> No login required
                </span>
              </div>
            </form>
          </div>

          {/* Right Column: Hero Illustration Animation */}
          <div className="hero-illustration-wrap" style={{ paddingTop: 90 }}>
            <HeroIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}


