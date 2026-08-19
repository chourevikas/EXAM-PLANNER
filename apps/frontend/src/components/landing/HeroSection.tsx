import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Layers, Target, Check, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { HeroIllustration } from './HeroIllustration';

interface HeroSectionProps {
  onSignup?: () => void;
  onLogin?: () => void;
}

// Initial canonical topics from DB hierarchy
const CANONICAL_TOPICS = [
  'Indian Polity & Governance',
  'Ancient History',
  'Modern History',
  'Indian Geography',
  'Oceanography',
  'Indian Economy',
  'Ecology & Environment',
  'Science & Technology',
  'Indian Culture',
  'General Science',
];

const CANONICAL_HIERARCHY: Record<string, string[]> = {
  'Indian Polity & Governance': [
    'Fundamental Rights',
    'Evolution of the Constitution',
    'Salient Features of Indian Constitution',
    'Directive Principles of State Policy (DPSP)',
    'Union Executive',
    'Union Legislature',
    'State Legislature',
    'The Judiciary',
    'Constitutional and Non Constitutional Bodies',
    'Governance',
  ],
  'Ancient History': [
    'Indus Valley Civilization',
    'Pre Historic Times',
    'Rig Vedic Period',
    'Later Vedic Period',
    'Jainism',
    'Buddhism',
    'Mauryan Empire',
    'Gupta Period',
  ],
  'Modern History': [
    'The Revolt Of 1857',
    'Advent of Europeans',
    'Indian National Movement',
    'Freedom Struggle 1919-1947',
  ],
  'Indian Geography': [
    'Physiography of India',
    'General Geography',
    'Geomorphology',
    'Oceanography',
    'Climatology',
    'Drainage System',
    'Climate',
  ],
  'Oceanography': [
    'Ocean Relief & Currents',
    'Salinity & Temperature',
    'Tides & Waves',
    'Marine Resources',
  ],
  'Indian Economy': [
    'Public Finance in India',
    'Basic Concepts',
    'Economic Measurements',
    'Money and Banking',
    'Planning',
    'Open Economy',
    'Economic Sectors',
  ],
  'Ecology & Environment': [
    'Biodiversity & Climate',
    'Environmental Ecology',
    'Resource Degradation and Management',
    'Environmental Pollution',
    'Climate Change',
    'Environmental Governance',
  ],
  'Science & Technology': [
    'Space',
    'IT and Communication',
    'Materials, Nano Technology and Robotics',
    'Defence',
    'Nuclear Technology',
    'Biotechnology',
  ],
  'Indian Culture': [
    'Visual Arts',
    'Performing Arts',
    'Religion, Language and Literature',
    'Miscellaneous Culture',
  ],
  'General Science': [
    'Biology',
    'Genetics',
    'Human Body & Systems',
    'Diseases & Nutrition',
  ],
};

// Supported Target Exams list
const TARGET_EXAM_OPTIONS = [
  'UPSC CSE',
  'State PSC',
  'SSC CGL',
  'Banking PO',
  'CAT / MBA',
  'Railways',
  'NDA',
  'CDS',
];

// Target exam year options
const TARGET_YEAR_OPTIONS = [
  'Target 2026',
  'Target 2025',
  'Target 2027',
  'Target 2028',
];

const QUESTION_COUNTS = [5, 10, 15, 20];

export function HeroSection({ }: HeroSectionProps) {
  const navigate = useNavigate();

  // Dynamic taxonomy state fetched directly from DB
  const [topicsList, setTopicsList] = useState<string[]>(CANONICAL_TOPICS);
  const [hierarchyMap, setHierarchyMap] = useState<Record<string, string[]>>(CANONICAL_HIERARCHY);
  const [examsList] = useState<string[]>(TARGET_EXAM_OPTIONS);

  // Form selections - default to actual topic and subtopic
  const [selectedExam, setSelectedExam] = useState<string>('UPSC CSE');
  const [selectedYear, setSelectedYear] = useState<string>('Target 2026');
  const [selectedTopic, setSelectedTopic] = useState<string>('Indian Polity & Governance');
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>('Fundamental Rights');
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Fetch Taxonomy (Topics & Subtopics) directly from DB / API
  useEffect(() => {
    async function loadDynamicTaxonomy() {
      try {
        const taxRes = await fetch('/api/v1/questions/taxonomy');

        if (taxRes.ok) {
          const taxData = await taxRes.json();
          if (taxData.topics && taxData.topics.length > 0) {
            const cleanTopics = taxData.topics.filter((t: string) => t !== 'All Topics' && t.trim() !== '');
            if (cleanTopics.length > 0) {
              setTopicsList(cleanTopics);
            }
          }
          if (taxData.hierarchy) {
            setHierarchyMap(taxData.hierarchy);
          }
        }
      } catch (err) {
        console.warn('Taxonomy DB fetch warning:', err);
      }
    }

    loadDynamicTaxonomy();
  }, []);

  // Compute available subtopics dynamically from fetched DB hierarchy
  const availableSubtopics = useMemo(() => {
    const rawSubs = hierarchyMap[selectedTopic];
    if (Array.isArray(rawSubs) && rawSubs.length > 0) {
      const cleanSubs = rawSubs.filter((s) => s !== 'All Subtopics' && s.trim() !== '');
      if (cleanSubs.length > 0) {
        return cleanSubs;
      }
    }
    return ['Fundamental Rights', 'Indus Valley Civilization', 'Union Legislature', 'Public Finance in India'];
  }, [selectedTopic, hierarchyMap]);

  const handleTopicChange = (newTopic: string) => {
    setSelectedTopic(newTopic);
    const rawSubs = hierarchyMap[newTopic];
    if (Array.isArray(rawSubs) && rawSubs.length > 0) {
      const cleanSubs = rawSubs.filter((s) => s !== 'All Subtopics' && s.trim() !== '');
      if (cleanSubs.length > 0) {
        setSelectedSubtopic(cleanSubs[0]);
        return;
      }
    }
    setSelectedSubtopic('Fundamental Rights');
  };

  const handleStartGuestExam = (e: React.FormEvent) => {
    e.preventDefault();

    const queryParams = new URLSearchParams({
      exam: selectedExam,
      year: selectedYear,
      topic: selectedTopic,
      subtopic: selectedSubtopic,
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
        paddingTop: '88px',
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
                fontSize: 'clamp(2rem, 3.2vw, 2.7rem)',
                fontWeight: 700,
                color: '#0F172A',
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                marginBottom: 20,
              }}
            >
              Test your exam readiness. <br />
              <span style={{ color: '#2563EB' }}>Start in 60 seconds.</span>
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

              {/* Form Row 2: Topic / subject & Subtopic */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                  marginBottom: 16,
                }}
              >
                {/* Topic / subject Select */}
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
                    <Layers size={13} style={{ color: '#2563EB' }} /> Topic / subject
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
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2563EB';
                      e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E2E8F0';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    {topicsList.map((top) => (
                      <option key={top} value={top}>
                        {top}
                      </option>
                    ))}
                  </select>
                </div>

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
                    onChange={(e) => setSelectedSubtopic(e.target.value)}
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
                    {availableSubtopics.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
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
                <span style={{ fontWeight: 600, color: '#0F172A' }}>Your mock:</span>
                <span style={{ color: '#0F172A', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedExam} · {selectedYear} · {selectedSubtopic}
                </span>
              </div>

              {/* Primary CTA Button */}
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 9,
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: 14.5,
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

              {/* Subtle Identity Footer */}
              <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                ExamPlanner PYQ Engine
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


