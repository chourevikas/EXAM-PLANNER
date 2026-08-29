import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Layers, Target, Check, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { HeroIllustration } from './HeroIllustration';
import { fetchMasterSyllabus, fetchExamsByYear } from '../../services/examService';

interface HeroSectionProps {
  onSignup?: () => void;
  onLogin?: () => void;
}

// Supported Target Exams list
const TARGET_EXAM_OPTIONS = [
  'UPSC CSE',
];

const QUESTION_COUNTS = [5, 10, 15, 20];

export function HeroSection({ }: HeroSectionProps) {
  const navigate = useNavigate();

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ mocks: any[], pyqs: any[], topics: any[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Dynamic 3-level taxonomy state fetched directly from Syllabus API (/api/v1/syllabus)
  const [masterSubjects, setMasterSubjects] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [threeLevelHierarchy, setThreeLevelHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [examsList] = useState<string[]>(TARGET_EXAM_OPTIONS);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState<boolean>(true);

  // Form selections (Subject is required, Topic is optional)
  const [selectedExam, setSelectedExam] = useState<string>('UPSC CSE');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics (Entire Subject)');
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Fetch Dynamic 3-level Taxonomy from Backend API (/api/v1/syllabus) and Exams By Year (/api/v1/exams/by-year)
  useEffect(() => {
    async function loadDynamicData() {
      setIsTaxonomyLoading(true);
      try {
        const taxData = await fetchMasterSyllabus();
        if (taxData) {
          if (taxData.subjects && Array.isArray(taxData.subjects) && taxData.subjects.length > 0) {
            setMasterSubjects(taxData.subjects);
          }
          if (taxData.subjects_list && Array.isArray(taxData.subjects_list) && taxData.subjects_list.length > 0) {
            const cleanSubs = taxData.subjects_list.filter((s: string) => s !== 'All Subjects' && s.trim() !== '');
            if (cleanSubs.length > 0) {
              setSubjectsList(cleanSubs);
              setSelectedSubject((prev) => (prev && cleanSubs.includes(prev) ? prev : cleanSubs[0]));
            }
          }
          if (taxData.hierarchy && typeof taxData.hierarchy === 'object') {
            setThreeLevelHierarchy(taxData.hierarchy);
          }
        }

        const yearsData = await fetchExamsByYear();
        if (yearsData && Array.isArray(yearsData.years) && yearsData.years.length > 0) {
          const fetchedYears = yearsData.years.map((y: number) => `${y} PYQs`);
          const minYear = Math.min(...yearsData.years);
          const maxYear = Math.max(...yearsData.years);
          const yearsArray = [`All Years (${minYear} - ${maxYear})`, ...fetchedYears];
          setYearOptions(yearsArray);
          setSelectedYear((prev) => (prev ? prev : yearsArray[0]));
        }
      } catch (err) {
        console.warn('Taxonomy / Exam years fetch warning:', err);
      } finally {
        setIsTaxonomyLoading(false);
      }
    }

    loadDynamicData();
  }, []);

  // Compute available topics for the chosen subject directly from DB taxonomy API
  const availableTopics = useMemo(() => {
    const defaultList = ['All Topics (Entire Subject)'];
    if (!selectedSubject) return defaultList;

    // 1. Check nested masterSubjects array
    const currentSubj = masterSubjects.find(
      (s) => s.name === selectedSubject || s.name.toLowerCase().includes(selectedSubject.toLowerCase())
    );
    if (currentSubj && currentSubj.topics && Array.isArray(currentSubj.topics) && currentSubj.topics.length > 0) {
      const topicNames = currentSubj.topics.map((t: any) => t.name).filter((n: string) => n && n.trim() !== '' && !n.startsWith('All Topics'));
      if (topicNames.length > 0) return [...defaultList, ...topicNames];
    }

    // 2. Check threeLevelHierarchy object dictionary
    const topicMap = threeLevelHierarchy[selectedSubject];
    if (topicMap && typeof topicMap === 'object') {
      const keys = Object.keys(topicMap).filter((k) => k.trim() !== '' && !k.startsWith('All Topics'));
      if (keys.length > 0) return [...defaultList, ...keys];
    }

    return defaultList;
  }, [selectedSubject, masterSubjects, threeLevelHierarchy]);

  const handleSubjectChange = (newSubject: string) => {
    setSelectedSubject(newSubject);
    setSelectedTopic('All Topics (Entire Subject)');
  };

  const handleTopicChange = (newTopic: string) => {
    setSelectedTopic(newTopic);
  };

  const handleStartGuestExam = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanTopic = selectedTopic.startsWith('All Topics') ? '' : selectedTopic;
    const cleanYear = selectedYear.startsWith('All Years') ? '' : (selectedYear.match(/\d{4}/)?.[0] || '');

    const queryParams = new URLSearchParams({
      exam: selectedExam,
      year: cleanYear,
      subject: selectedSubject,
      topic: cleanTopic,
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
          background: 'radial-gradient(ellipse at center, rgba(227,27,35,0.045) 0%, transparent 70%)',
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
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 0,
                padding: '5px 12px',
                marginBottom: 14,
              }}
            >
              <Zap size={13} strokeWidth={2.5} style={{ color: '#E31B23' }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#E31B23', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                INSTANT PYQ MOCK TEST
              </span>
            </div>

            {/* Main Heading */}
            <h1
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
                fontWeight: 800,
                color: '#172033',
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
              Master UPSC with <br />
              <span style={{ color: '#E31B23', fontWeight: 800 }}>Precision Analytics.</span>
            </h1>

            {/* Premium Mock Builder Form Card */}
            <form
              onSubmit={handleStartGuestExam}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 0,
                padding: '24px 26px',
                boxShadow: '0 10px 28px -4px rgba(15, 23, 42, 0.05), 0 3px 10px -2px rgba(15, 23, 42, 0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Card Header */}
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 16.5, fontWeight: 700, color: '#172033', margin: 0, lineHeight: 1.25 }}>
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
                      color: '#172033',
                      marginBottom: 5,
                    }}
                  >
                    <BookOpen size={13} style={{ color: '#E31B23' }} /> Target exam
                  </label>
                  <select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 0,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#172033',
                      fontSize: 13,
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#E31B23';
                      e.target.style.boxShadow = '0 0 0 3px rgba(227,27,35,0.12)';
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
                      color: '#172033',
                      marginBottom: 5,
                    }}
                  >
                    <Calendar size={13} style={{ color: '#E31B23' }} /> Target year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 0,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#172033',
                      fontSize: 13,
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#E31B23';
                      e.target.style.boxShadow = '0 0 0 3px rgba(227,27,35,0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#E2E8F0';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    {yearOptions.map((yr) => (
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
                      color: '#172033',
                      marginBottom: 5,
                    }}
                  >
                    <BookOpen size={13} style={{ color: '#E31B23' }} /> Subject
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 0,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#172033',
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
                      color: '#172033',
                      marginBottom: 5,
                    }}
                  >
                    <Layers size={13} style={{ color: '#E31B23' }} /> Topic
                  </label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 0,
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      color: '#172033',
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

              {/* Form Row 3: Primary CTA Button */}
              <div
                style={{
                  marginBottom: 14,
                }}
              >
                <button
                  type="submit"
                  style={{
                    width: '100%',
                    height: 42,
                    borderRadius: 0,
                    border: 'none',
                    backgroundColor: '#E31B23',
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(227, 27, 35, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#C1121F';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(227, 27, 35, 0.32)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#E31B23';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(227, 27, 35, 0.22)';
                  }}
                >
                  Start Free Mock
                  <ArrowRight size={16} strokeWidth={2.2} />
                </button>
              </div>

              {/* Contextual Mock Summary Bar */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  padding: '8px 12px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#64748B',
                }}
              >
                <span style={{ fontWeight: 600, color: '#172033' }}>Your practice session:</span>
                <span style={{ color: '#172033', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedSubject} · {selectedTopic} ({questionCount} Qs)
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
                  <CheckCircle2 size={13} style={{ color: '#3A8B53' }} /> Authentic PYQs
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={12.5} style={{ color: '#E31B23' }} /> Instant mock
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 0, backgroundColor: '#64748B', display: 'inline-block' }} /> No login required
                </span>
              </div>
            </form>
          </div>

          {/* Right Column: Hero Illustration Animation */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              minHeight: 460,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              perspective: 1200,
            }}
          >
            {/* Soft backdrop glow */}
            <div
              style={{
                position: 'absolute',
                width: '85%',
                height: '85%',
                background: 'radial-gradient(circle at center, rgba(227,27,35,0.08) 0%, transparent 70%)',
                filter: 'blur(30px)',
                zIndex: 0,
              }}
            />
            
            <HeroIllustration />
          </div>

          {/* Right Column: Global Search Feature (Hidden for now) */}
          {false && (
          <div className="hero-search-wrap" style={{ paddingTop: 40, position: 'relative' }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#172033', margin: 0 }}>
                Explore Global Search
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>
                Quickly find Mock Tests, PYQs, and specific Topics across the platform.
              </p>
            </div>
            <div style={{ position: 'relative' }}>
              <form
                onSubmit={(e) => e.preventDefault()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#FFFFFF',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
                  border: '1px solid #E2E8F0',
                  overflow: 'visible',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  height: 52
                }}
              >
                <select
                  style={{
                    padding: '0 16px',
                    border: 'none',
                    borderRight: '1px solid #E2E8F0',
                    background: 'transparent',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#172033',
                    outline: 'none',
                    cursor: 'pointer',
                    borderRadius: '8px 0 0 8px',
                    height: '100%'
                  }}
                >
                  <option value="All Exams">All Exams</option>
                  <option value="UPSC CSE">UPSC CSE</option>
                </select>
                <input
                  type="text"
                  placeholder="Search a topic, year, or question..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  style={{
                    flex: 1,
                    padding: '0 16px',
                    border: 'none',
                    fontSize: 15,
                    color: '#172033',
                    outline: 'none',
                    height: '100%'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: '#E31B23',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0 24px',
                    fontWeight: 700,
                    fontSize: 15,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    borderRadius: '0 8px 8px 0',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C1121F')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E31B23')}
                >
                  Search
                </button>
              </form>

              {/* Autocomplete Dropdown */}
              {showDropdown && searchQuery.trim().length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 8,
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                    zIndex: 100,
                    maxHeight: 400,
                    overflowY: 'auto',
                    borderRadius: 8
                  }}
                >
                  {isSearching ? (
                    <div style={{ padding: '16px', fontSize: 13, color: '#64748B', textAlign: 'center' }}>Searching...</div>
                  ) : searchResults ? (
                    <>
                      {(searchResults?.topics?.length || 0) > 0 && (
                        <div>
                          <div style={{ padding: '8px 12px', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Topics & Concepts</div>
                          {searchResults?.topics.map((t) => (
                            <div key={t.id} onClick={() => { setShowDropdown(false); navigate(t.url); }} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{t.title}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{t.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {(searchResults?.pyqs?.length || 0) > 0 && (
                        <div>
                          <div style={{ padding: '8px 12px', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Previous Year Papers</div>
                          {searchResults?.pyqs.map((p) => (
                            <div key={p.id} onClick={() => { setShowDropdown(false); navigate(p.url); }} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{p.title}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{p.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {(searchResults?.mocks?.length || 0) > 0 && (
                        <div>
                          <div style={{ padding: '8px 12px', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Mock Tests</div>
                          {searchResults?.mocks.map((m) => (
                            <div key={m.id} onClick={() => { setShowDropdown(false); navigate(m.url); }} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>{m.title}</div>
                              <div style={{ fontSize: 11, color: '#64748B' }}>{m.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {(!searchResults?.topics.length && !searchResults?.pyqs.length && !searchResults?.mocks.length) && (
                        <div style={{ padding: '16px', fontSize: 13, color: '#64748B', textAlign: 'center' }}>No results found</div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </section>
  );
}


