import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
import { listExams, listCandidateAttempts, formatCanonicalExamTitle, fetchMasterSyllabus, fetchExamsByYear } from '../services/examService';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  CheckCircle2,
  PlayCircle,
  BarChart2,
  RotateCcw,
  Zap,
  ArrowRight,
  ChevronRight,
  Target,
} from 'lucide-react';

interface DisplayMock {
  id: number | string;
  title: string;
  category: string;
  totalQuestions: number;
  duration: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  completedAttemptId?: number | string;
  inProgressAttemptId?: number | string;
  scoreText?: string;
  progressPercent?: number;
}

export function MockSelectionPage() {
  const navigate = useNavigate();
  const [hoveredMock, setHoveredMock] = useState<number | string | null>(null);
  const [mocksList, setMocksList] = useState<DisplayMock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getToken } = useAuth();

  // Dynamic 3-level taxonomy state fetched directly from DB / Syllabus API (/api/v1/syllabus)
  const [masterSubjects, setMasterSubjects] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [threeLevelHierarchy, setThreeLevelHierarchy] = useState<Record<string, Record<string, string[]>>>({});
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState<boolean>(true);

  // Form selections
  const [selectedExam, setSelectedExam] = useState<string>('UPSC CSE');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics (Entire Subject)');

  // Fetch Dynamic 3-level Taxonomy (/api/v1/syllabus) & Exams By Year (/api/v1/exams/by-year)
  useEffect(() => {
    async function loadDynamicTaxonomy() {
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

    loadDynamicTaxonomy();
  }, []);

  // Compute available topics for the chosen subject directly from DB taxonomy API
  const availableTopics = useMemo(() => {
    const defaultList = ['All Topics (Entire Subject)'];
    if (!selectedSubject) return defaultList;

    const currentSubj = masterSubjects.find(
      (s) => s.name === selectedSubject || s.name.toLowerCase().includes(selectedSubject.toLowerCase())
    );
    if (currentSubj && currentSubj.topics && Array.isArray(currentSubj.topics) && currentSubj.topics.length > 0) {
      const topicNames = currentSubj.topics.map((t: any) => t.name).filter((n: string) => n && n.trim() !== '' && !n.startsWith('All Topics'));
      if (topicNames.length > 0) return [...defaultList, ...topicNames];
    }

    const topicMap = threeLevelHierarchy[selectedSubject];
    if (topicMap && typeof topicMap === 'object') {
      const keys = Object.keys(topicMap).filter((k) => k.trim() !== '' && !k.startsWith('All Topics'));
      if (keys.length > 0) return [...defaultList, ...keys];
    }

    return defaultList;
  }, [selectedSubject, masterSubjects, threeLevelHierarchy]);

  useEffect(() => {
    async function fetchLiveMocksAndAttempts() {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (token) {
          localStorage.setItem('access_token', token);
        }
        const [liveExams, userAttempts] = await Promise.all([
          listExams(undefined, true, token || undefined),
          listCandidateAttempts(token || undefined),
        ]);

        const mocks = liveExams.filter(
          (e) => e.is_active === true && (e.exam_type === 'STATIC_MOCK' || e.exam_type === 'QuestionSourceType.STATIC_MOCK')
        );

        const targetList = mocks.length > 0 ? mocks : liveExams.filter((e) => e.is_active === true);

        if (targetList.length > 0) {
          const mapped: DisplayMock[] = targetList.map((e, index) => {
            const examAttempts = userAttempts.filter(
              (att) => att.exam_id === e.id || att.exam_id === e.code
            );
            examAttempts.sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime());

            const completedAttempt = examAttempts.find((att) =>
              ['COMPLETED', 'SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(att.status)
            );
            const inProgressAttempt = examAttempts.find((att) => att.status === 'IN_PROGRESS');

            let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
            let scoreText: string | undefined = undefined;
            let progressPercent: number | undefined = undefined;

            if (inProgressAttempt) {
              status = 'IN_PROGRESS';
              progressPercent = 65;
            } else if (completedAttempt) {
              status = 'COMPLETED';
              scoreText = `${completedAttempt.total_score || 0} / ${completedAttempt.max_possible_score || 200}`;
            }

            return {
              id: e.id,
              title: formatCanonicalExamTitle(e),
              category: 'PRELIMS',
              totalQuestions: 100,
              duration: `${e.total_duration_minutes || 120} mins`,
              status,
              completedAttemptId: completedAttempt?.attempt_id,
              inProgressAttemptId: inProgressAttempt?.attempt_id,
              scoreText,
              progressPercent,
            };
          });
          setMocksList(mapped);
        } else {
          setMocksList([]);
        }
      } catch (err) {
        console.warn('Failed to load real-time mocks & attempts:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLiveMocksAndAttempts();
  }, []);

  const handleStartPracticeTest = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSubject = selectedSubject || (subjectsList.length > 0 ? subjectsList[0] : '');
    const finalTopic = selectedTopic || 'All Topics (Entire Subject)';
    const finalYear = selectedYear || (yearOptions.length > 0 ? yearOptions[0] : '');

    const queryParams = new URLSearchParams({
      exam: selectedExam,
      year: finalYear,
      subject: finalSubject,
      topic: finalTopic,
    });


    navigate(`/practice-exam?${queryParams.toString()}`);
  };

  return (
    <StudentLayout pageTitle="Practice Tests">
      {/* Top Banner Hero Container */}
      <section style={{
        marginBottom: 32,
        padding: '32px 36px',
        borderRadius: 0,
        background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 50%, #FAF5FF 100%)',
        border: '1px solid #E0E7FF',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.05)'
      }}>

        <div style={{ maxWidth: '600px', zIndex: 2 }}>
          {/* Capsule Pill Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            backgroundColor: '#E0E7FF',
            color: '#3730A3',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 0,
            marginBottom: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            <Zap size={13} fill="#4338CA" color="#4338CA" /> ADAPTIVE PRACTICE
          </div>

          <h1 style={{
            fontSize: 32,
            fontWeight: 800,
            color: '#1E1B4B',
            margin: '0 0 10px 0',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}>
            Practice Tests
          </h1>

          <p style={{
            fontSize: 14,
            color: '#4338CA',
            margin: 0,
            lineHeight: 1.6,
            fontWeight: 500
          }}>
            Configure a targeted practice test by topic and subtopic, or attempt full-length test series.
          </p>
        </div>

        {/* Right Side Illustration Graphic (Checklist + Bullseye Target) */}
        <div style={{ position: 'relative', flexShrink: 0, width: 220, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="220" height="140" viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Soft decorative background circles */}
            <circle cx="160" cy="70" r="55" fill="#E0E7FF" fillOpacity="0.5" />
            <circle cx="180" cy="40" r="15" fill="#DDD6FE" fillOpacity="0.6" />

            {/* Checklist Clipboard */}
            <g transform="translate(45, 15) rotate(-6)">
              <rect x="0" y="0" width="85" height="110" rx="10" fill="#FFFFFF" filter="drop-shadow(0px 8px 16px rgba(99, 102, 241, 0.15))" stroke="#C7D2FE" strokeWidth="2" />
              <rect x="28" y="-6" width="30" height="12" rx="4" fill="#F2B623" />
              {/* Lines and checkmarks */}
              <circle cx="20" cy="30" r="6" stroke="#6366F1" strokeWidth="2" fill="none" />
              <path d="M17 30L19 32L23 28" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="34" y="27" width="38" height="6" rx="3" fill="#E0E7FF" />

              <circle cx="20" cy="55" r="6" stroke="#6366F1" strokeWidth="2" fill="none" />
              <path d="M17 55L19 57L23 53" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="34" y="52" width="38" height="6" rx="3" fill="#E0E7FF" />

              <circle cx="20" cy="80" r="6" stroke="#6366F1" strokeWidth="2" fill="none" />
              <path d="M17 80L19 82L23 78" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="34" y="77" width="28" height="6" rx="3" fill="#E0E7FF" />
            </g>

            {/* Bullseye Target & Dart */}
            <g transform="translate(130, 35)">
              <circle cx="45" cy="45" r="35" fill="#EF4444" filter="drop-shadow(0px 6px 12px rgba(227, 27, 35, 0.25))" />
              <circle cx="45" cy="45" r="25" fill="#FFFFFF" />
              <circle cx="45" cy="45" r="15" fill="#EF4444" />
              <circle cx="45" cy="45" r="6" fill="#FFFFFF" />

              {/* Dart Shaft hitting center */}
              <path d="M75 15L48 42" stroke="#6366F1" strokeWidth="5" strokeLinecap="round" />
              <path d="M75 15L85 5L75 5L75 15Z" fill="#818CF8" />
              <path d="M75 15L85 25L85 15L75 15Z" fill="#818CF8" />
            </g>
          </svg>
        </div>
      </section>

      {/* Instant Topic & Subtopic Generator Card */}
      <section style={{
        marginBottom: 36,
        padding: '28px 32px',
        borderRadius: 0,
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 0,
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>
            <Zap size={22} fill="#FFFFFF" color="#FFFFFF" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#172033', margin: 0 }}>
              Instant Practice Test Generator
            </h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '3px 0 0 0' }}>
              Select your target subject, topic, and subtopic to launch a custom practice test.
            </p>
          </div>
        </div>

        <form onSubmit={handleStartPracticeTest}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Target Exam */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Target Exam
              </label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: '1px solid #E2E8F0', backgroundColor: '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 500, outline: 'none',
                }}
              >
                <option value="UPSC CSE">UPSC CSE (Civil Services)</option>
              </select>
            </div>

            {/* Target / PYQ Year */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Target / PYQ Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: '1px solid #E2E8F0', backgroundColor: '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 500, outline: 'none',
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedTopic('All Topics (Entire Subject)');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: '1px solid #E2E8F0', backgroundColor: '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 500, outline: 'none',
                }}
              >
                {subjectsList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Topic */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Topic
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: '1px solid #E2E8F0', backgroundColor: '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 500, outline: 'none',
                }}
              >
                {availableTopics.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* CTA Button Row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingTop: 20, borderTop: '1px dashed #E2E8F0'
          }}>
            <button
              type="submit"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 0,
                background: 'linear-gradient(135deg, #4F46E5 0%, #E31B23 100%)',
                color: '#FFFFFF', fontWeight: 700, fontSize: 14, border: 'none',
                cursor: 'pointer', boxShadow: '0 4px 14px rgba(227, 27, 35, 0.35)',
                transition: 'transform 0.15s ease, boxShadow 0.15s ease',
              }}
            >
              <PlayCircle size={18} fill="#FFFFFF" color="#E31B23" />
              <span>Start Practice Test</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </section>

      {/* Full-Length & Curated Test Series Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#172033', margin: 0 }}>
            Full-Length & Curated Test Series
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '3px 0 0 0' }}>
            Attempt structured tests or revisit your previous attempts.
          </p>
        </div>

        <Link
          to="/pyq"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#E31B23',
            textDecoration: 'none',
            padding: '6px 12px',
            borderRadius: 0,
            border: '1px solid #F8FAFC',
            backgroundColor: '#F8FAFC',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          View All Tests <ChevronRight size={14} />
        </Link>
      </div>

      {/* Test Series Cards Grid */}
      {isLoading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
          <div className="spinner" style={{ marginBottom: 12 }} />
          Loading test series archive...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {mocksList.slice(0, 3).map((mock) => {
            const isCompleted = mock.status === 'COMPLETED';
            const isInProgress = mock.status === 'IN_PROGRESS';

            return (
              <div
                key={mock.id}
                onMouseEnter={() => setHoveredMock(mock.id)}
                onMouseLeave={() => setHoveredMock(null)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 0,
                  border: `1px solid ${hoveredMock === mock.id ? '#E31B23' : isCompleted ? '#A7F3D0' : '#E2E8F0'}`,
                  padding: '24px',
                  boxShadow: hoveredMock === mock.id
                    ? '0 8px 24px rgba(15, 23, 42, 0.08)'
                    : '0 1px 3px rgba(15, 23, 42, 0.03)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 20
                }}
              >
                <div>
                  {/* Category Badge & Status Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 0,
                      backgroundColor: '#F8FAFC',
                      color: '#E31B23',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {mock.category}
                    </span>

                    {isCompleted ? (
                      <StatusBadge status="completed" label="Completed" size="sm" />
                    ) : isInProgress ? (
                      <StatusBadge status="in-progress" label="In Progress" size="sm" />
                    ) : (
                      <StatusBadge status="active" label="Ready" size="sm" />
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#172033', margin: '0 0 8px 0' }}>
                    {mock.title}
                  </h3>

                  {/* Questions & Duration */}
                  <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
                    {mock.totalQuestions} Questions &nbsp;•&nbsp; {mock.duration}
                  </div>

                  {/* In Progress: Progress Bar */}
                  {isInProgress && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#EA580C', marginBottom: 6 }}>
                        <span>65% Completed</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 0, backgroundColor: '#F1F5F9', overflow: 'hidden' }}>
                        <div style={{ width: '65%', height: '100%', backgroundColor: '#F47B35', borderRadius: 0 }} />
                      </div>
                    </div>
                  )}

                  {/* Completed: Score Badge */}
                  {isCompleted && (
                    <div style={{ marginTop: 10, padding: '4px 10px', backgroundColor: '#ECFDF5', borderRadius: 0, fontSize: 12, fontWeight: 700, color: '#3A8B53', display: 'inline-block' }}>
                      Score: {mock.scoreText || '0 / 200'}
                    </div>
                  )}
                </div>

                {/* Bottom Action Button(s) */}
                <div style={{ paddingTop: 8 }}>
                  {isInProgress ? (
                    <Link
                      to={`/exam/${mock.inProgressAttemptId || mock.id}?type=MOCK`}
                      style={{
                        width: '100%',
                        height: 40,
                        borderRadius: 0,
                        backgroundColor: '#FFF7ED',
                        border: '1px solid #FFEDD5',
                        color: '#EA580C',
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxSizing: 'border-box'
                      }}
                    >
                      <RotateCcw size={15} /> Resume Practice
                    </Link>
                  ) : isCompleted ? (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Link
                        to={`/exam/${mock.id}?type=MOCK`}
                        style={{
                          flex: 1,
                          height: 40,
                          borderRadius: 0,
                          backgroundColor: '#3A8B53',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: 13,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxSizing: 'border-box'
                        }}
                      >
                        <PlayCircle size={15} fill="#FFFFFF" color="#3A8B53" /> Retake Test
                      </Link>

                      <Link
                        to={`/analytics?attemptId=${mock.completedAttemptId || mock.id}`}
                        style={{
                          padding: '0 16px',
                          height: 40,
                          borderRadius: 0,
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          color: '#334155',
                          fontWeight: 600,
                          fontSize: 13,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          boxSizing: 'border-box'
                        }}
                      >
                        <BarChart2 size={15} /> Report
                      </Link>
                    </div>
                  ) : (
                    <Link
                      to={`/exam/${mock.id}?type=MOCK`}
                      style={{
                        width: '100%',
                        height: 40,
                        borderRadius: 0,
                        backgroundColor: '#E31B23',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxSizing: 'border-box',
                        boxShadow: '0 2px 6px rgba(227, 27, 35, 0.25)'
                      }}
                    >
                      <PlayCircle size={15} fill="#FFFFFF" color="#E31B23" /> Start Test
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StudentLayout>
  );
}
