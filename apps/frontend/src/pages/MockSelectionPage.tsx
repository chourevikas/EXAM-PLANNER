import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  listExams,
  getAttemptStatusByExam,
  formatCanonicalExamTitle,
  fetchMasterSyllabus,
  fetchExamsByYear,
} from '../services/examService';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatEnum, extractCanonicalExamName } from '../utils/formatEnum';
import {
  CheckCircle2,
  PlayCircle,
  BarChart2,
  RotateCcw,
  Zap,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Check,
  Search,
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoveredMock, setHoveredMock] = useState<number | string | null>(null);
  const [mocksList, setMocksList] = useState<DisplayMock[]>([]);
  const { getToken } = useAuth();

  // Dynamic 3-level taxonomy & exam state
  const [masterSyllabus, setMasterSyllabus] = useState<any>(null);
  const [availableExams, setAvailableExams] = useState<string[]>(['UPSC CSE']);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState<boolean>(true);

  // Form selections matching StudentPracticeExamPage
  const [selectedExam, setSelectedExam] = useState<string>('UPSC CSE');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSubjectsList, setSelectedSubjectsList] = useState<string[]>([]);
  const [selectedTopicsList, setSelectedTopicsList] = useState<string[]>([]);
  const [selectedSubtopicsList, setSelectedSubtopicsList] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All Levels');

  // Popover state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close active dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch Dynamic 3-level Taxonomy (/api/v1/syllabus), Exams By Year (/api/v1/exams/by-year), & Published Exams
  useEffect(() => {
    async function loadDynamicTaxonomy() {
      setIsTaxonomyLoading(true);
      try {
        const [taxData, yearsData, publishedExams] = await Promise.all([
          fetchMasterSyllabus().catch(() => null),
          fetchExamsByYear().catch(() => null),
          listExams('PUBLISHED').catch(() => []),
        ]);

        if (taxData) {
          setMasterSyllabus(taxData);
        }

        if (yearsData && Array.isArray(yearsData.years) && yearsData.years.length > 0) {
          const fetchedYears = yearsData.years.map((y: number) => `${y} PYQs`);
          const minYear = Math.min(...yearsData.years);
          const maxYear = Math.max(...yearsData.years);
          const yearsArray = [`All Years (${minYear} - ${maxYear})`, ...fetchedYears];
          setYearOptions(yearsArray);
          setSelectedYear((prev) => (prev ? prev : yearsArray[0]));
        }

        const dynamicExams: string[] = [];
        if (Array.isArray(publishedExams) && publishedExams.length > 0) {
          publishedExams.forEach((e: any) => {
            const canonical = extractCanonicalExamName(e.name || e.title || e.exam_name || e.code);
            if (canonical) dynamicExams.push(canonical);
          });
        }

        const distinctExams = Array.from(new Set(dynamicExams)) as string[];
        distinctExams.sort((a, b) => (a === 'UPSC CSE' ? -1 : b === 'UPSC CSE' ? 1 : a.localeCompare(b)));

        if (distinctExams.length > 0) {
          setAvailableExams(distinctExams);
        } else {
          setAvailableExams(['UPSC CSE']);
        }
      } catch (err) {
        console.warn('Taxonomy / Exam years fetch warning:', err);
      } finally {
        setIsTaxonomyLoading(false);
      }
    }

    loadDynamicTaxonomy();
  }, []);

  // Live mocks and student attempt status
  useEffect(() => {
    async function fetchLiveMocksAndAttempts() {
      setIsLoading(true);
      try {
        const token = await getToken();
        if (token) {
          localStorage.setItem('access_token', token);
        }
        const [liveExams, statusByExam] = await Promise.all([
          listExams(undefined, true, token || undefined),
          getAttemptStatusByExam(token || undefined),
        ]);

        const mocks = liveExams.filter(
          (e) => e.is_active === true && (e.exam_type === 'STATIC_MOCK' || e.exam_type === 'QuestionSourceType.STATIC_MOCK')
        );

        const targetList = mocks.length > 0 ? mocks : liveExams.filter((e) => e.is_active === true);

        if (targetList.length > 0) {
          const mapped: DisplayMock[] = targetList.map((e) => {
            const attemptStatus = statusByExam[String(e.id)];

            let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';
            let scoreText: string | undefined = undefined;
            let progressPercent: number | undefined = undefined;

            if (attemptStatus?.in_progress_attempt_id) {
              status = 'IN_PROGRESS';
              progressPercent = 65;
            } else if (attemptStatus?.completed_attempt_id) {
              status = 'COMPLETED';
              scoreText = `${attemptStatus.total_score || 0} / ${attemptStatus.max_possible_score || 200}`;
            }

            return {
              id: e.id,
              title: formatCanonicalExamTitle(e),
              category: 'PRELIMS',
              totalQuestions: 100,
              duration: `${e.total_duration_minutes || 120} mins`,
              status,
              completedAttemptId: attemptStatus?.completed_attempt_id,
              inProgressAttemptId: attemptStatus?.in_progress_attempt_id,
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

  // Subjects list from master syllabus
  const subjectsList = useMemo<string[]>(() => {
    if (masterSyllabus?.hierarchy) {
      const keys = Object.keys(masterSyllabus.hierarchy);
      if (keys.length > 0) return keys;
    }
    if (masterSyllabus?.subjects && Array.isArray(masterSyllabus.subjects)) {
      return masterSyllabus.subjects.map((s: any) => String(s.name || '')).filter(Boolean);
    }
    return [];
  }, [masterSyllabus]);

  // Computed dynamic list of topics based on selected subjects
  const availableTopicsList = useMemo<string[]>(() => {
    const hierarchy = masterSyllabus?.hierarchy || {};
    const topicsSet = new Set<string>();
    if (selectedSubjectsList.length === 0) {
      Object.values(hierarchy).forEach((topicsMap: any) => {
        if (topicsMap && typeof topicsMap === 'object') {
          Object.keys(topicsMap).forEach((t) => topicsSet.add(t));
        }
      });
    } else {
      selectedSubjectsList.forEach((subj) => {
        const topicsMap = hierarchy[subj];
        if (topicsMap && typeof topicsMap === 'object') {
          Object.keys(topicsMap).forEach((t) => topicsSet.add(t));
        }
      });
    }
    return Array.from(topicsSet).sort();
  }, [selectedSubjectsList, masterSyllabus]);

  // Computed dynamic list of subtopics based on selected subjects and topics
  const availableSubtopicsList = useMemo<string[]>(() => {
    const hierarchy = masterSyllabus?.hierarchy || {};
    const subSet = new Set<string>();
    if (selectedTopicsList.length > 0) {
      if (selectedSubjectsList.length > 0) {
        selectedSubjectsList.forEach((subj) => {
          const topicsMap = hierarchy[subj] || {};
          selectedTopicsList.forEach((top) => {
            const list = topicsMap[top];
            if (Array.isArray(list)) {
              list.forEach((st: string) => {
                if (!st.startsWith('All Subtopics')) subSet.add(st);
              });
            }
          });
        });
      } else {
        Object.values(hierarchy).forEach((topicsMap: any) => {
          if (topicsMap && typeof topicsMap === 'object') {
            selectedTopicsList.forEach((top) => {
              const list = topicsMap[top];
              if (Array.isArray(list)) {
                list.forEach((st: string) => {
                  if (!st.startsWith('All Subtopics')) subSet.add(st);
                });
              }
            });
          }
        });
      }
    } else if (selectedSubjectsList.length > 0) {
      selectedSubjectsList.forEach((subj) => {
        const topicsMap = hierarchy[subj] || {};
        Object.values(topicsMap).forEach((subList: any) => {
          if (Array.isArray(subList)) {
            subList.forEach((st: string) => {
              if (!st.startsWith('All Subtopics')) subSet.add(st);
            });
          }
        });
      });
    } else {
      Object.values(hierarchy).forEach((topicsMap: any) => {
        if (topicsMap && typeof topicsMap === 'object') {
          Object.values(topicsMap).forEach((subList: any) => {
            if (Array.isArray(subList)) {
              subList.forEach((st: string) => {
                if (!st.startsWith('All Subtopics')) subSet.add(st);
              });
            }
          });
        }
      });
    }
    return Array.from(subSet).sort();
  }, [selectedSubjectsList, selectedTopicsList, masterSyllabus]);

  // Multi-Select Toggle & Select All Helpers
  const toggleSubjectFilter = (subjectName: string) => {
    if (subjectName === 'All Subjects') {
      setSelectedSubjectsList([]);
      setSelectedTopicsList([]);
      setSelectedSubtopicsList([]);
    } else {
      let updated: string[];
      if (selectedSubjectsList.includes(subjectName)) {
        updated = selectedSubjectsList.filter((s) => s !== subjectName);
      } else {
        updated = [...selectedSubjectsList, subjectName];
      }
      setSelectedSubjectsList(updated);
      setSelectedTopicsList([]);
      setSelectedSubtopicsList([]);
    }
  };

  const selectAllSubjects = () => {
    setSelectedSubjectsList([...subjectsList]);
    setSelectedTopicsList([]);
    setSelectedSubtopicsList([]);
  };

  const toggleTopicFilter = (topicName: string) => {
    if (topicName === 'All Topics') {
      setSelectedTopicsList([]);
      setSelectedSubtopicsList([]);
    } else {
      let updated: string[];
      if (selectedTopicsList.includes(topicName)) {
        updated = selectedTopicsList.filter((t) => t !== topicName);
      } else {
        updated = [...selectedTopicsList, topicName];
      }
      setSelectedTopicsList(updated);
      setSelectedSubtopicsList([]);
    }
  };

  const selectAllTopics = () => {
    setSelectedTopicsList([...availableTopicsList]);
    setSelectedSubtopicsList([]);
  };

  const toggleSubtopicFilter = (subtopicName: string) => {
    if (subtopicName === 'All Subtopics') {
      setSelectedSubtopicsList([]);
    } else {
      let updated: string[];
      if (selectedSubtopicsList.includes(subtopicName)) {
        updated = selectedSubtopicsList.filter((st) => st !== subtopicName);
      } else {
        updated = [...selectedSubtopicsList, subtopicName];
      }
      setSelectedSubtopicsList(updated);
    }
  };

  const selectAllSubtopics = () => {
    setSelectedSubtopicsList([...availableSubtopicsList]);
  };

  const handleStartPracticeTest = (e: React.FormEvent) => {
    e.preventDefault();
    const queryParams = new URLSearchParams();

    if (selectedExam) {
      queryParams.set('exam', selectedExam);
    }
    if (selectedYear) {
      queryParams.set('year', selectedYear);
    }
    if (selectedSubjectsList.length > 0) {
      queryParams.set('subject', selectedSubjectsList.join(','));
    }
    if (selectedTopicsList.length > 0) {
      queryParams.set('topic', selectedTopicsList.join(','));
    }
    if (selectedSubtopicsList.length > 0) {
      queryParams.set('subtopic', selectedSubtopicsList.join(','));
    }
    if (selectedDifficulty && selectedDifficulty !== 'All Levels') {
      queryParams.set('difficulty', selectedDifficulty);
    }

    navigate(`/practice-exam?${queryParams.toString()}`);
  };

  return (
    <StudentLayout pageTitle="Practice Tests">
      {/* Instant Practice Test Generator Card */}
      <section
        ref={dropdownRef}
        style={{
          marginBottom: 36,
          padding: '28px 32px',
          borderRadius: 0,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        }}
      >
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
            {/* Filter 1: Target Exam */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Target Exam
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'exam' ? null : 'exam');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: activeDropdown === 'exam' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'exam' ? '#FFFFFF' : '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 600, outline: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: activeDropdown === 'exam' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedExam || 'UPSC CSE'}
                </span>
                <ChevronDown
                  size={14}
                  color="#64748B"
                  style={{
                    transform: activeDropdown === 'exam' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0
                  }}
                />
              </button>

              {activeDropdown === 'exam' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 220,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 0,
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 6,
                    zIndex: 100,
                  }}
                >
                  {(availableExams.length > 0 ? availableExams : ['UPSC CSE']).map((opt) => (
                    <div
                      key={opt}
                      onClick={() => {
                        setSelectedExam(opt);
                        setActiveDropdown(null);
                      }}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 0,
                        fontSize: 12.5,
                        fontWeight: selectedExam === opt ? 700 : 500,
                        color: selectedExam === opt ? '#1E3A8A' : '#334155',
                        backgroundColor: selectedExam === opt ? '#F8FAFC' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{opt}</span>
                      {selectedExam === opt && <Check size={14} color="#1E3A8A" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filter 2: Target / PYQ Year */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Target / PYQ Year
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'year' ? null : 'year');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: activeDropdown === 'year' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'year' ? '#FFFFFF' : '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 600, outline: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: activeDropdown === 'year' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedYear || 'All Years'}
                </span>
                <ChevronDown
                  size={14}
                  color="#64748B"
                  style={{
                    transform: activeDropdown === 'year' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0
                  }}
                />
              </button>

              {activeDropdown === 'year' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 220,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 0,
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 6,
                    zIndex: 100,
                    maxHeight: 220,
                    overflowY: 'auto'
                  }}
                >
                  {(yearOptions.length > 0 ? yearOptions : ['All Years (2017 - 2024)']).map((opt) => (
                    <div
                      key={opt}
                      onClick={() => {
                        setSelectedYear(opt);
                        setActiveDropdown(null);
                      }}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 0,
                        fontSize: 12.5,
                        fontWeight: selectedYear === opt ? 700 : 500,
                        color: selectedYear === opt ? '#1E3A8A' : '#334155',
                        backgroundColor: selectedYear === opt ? '#F8FAFC' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{opt}</span>
                      {selectedYear === opt && <Check size={14} color="#1E3A8A" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filter 3: Subject Focus */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Subject Focus
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'subject' ? null : 'subject');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: activeDropdown === 'subject' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'subject' ? '#FFFFFF' : '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 600, outline: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: activeDropdown === 'subject' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedSubjectsList.length === 0
                    ? 'All Subjects'
                    : selectedSubjectsList.length === 1
                      ? formatEnum(selectedSubjectsList[0])
                      : `${selectedSubjectsList.length} Subjects Selected`}
                </span>
                <ChevronDown
                  size={14}
                  color="#64748B"
                  style={{
                    transform: activeDropdown === 'subject' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0
                  }}
                />
              </button>

              {activeDropdown === 'subject' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 250,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 0,
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 10,
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                    <button type="button" onClick={selectAllSubjects} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => toggleSubjectFilter('All Subjects')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>

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
                    {subjectsList
                      .filter((s: string) => s.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                      .map((opt: string) => {
                        const isSelected = selectedSubjectsList.includes(opt);
                        return (
                          <div
                            key={opt}
                            onClick={() => toggleSubjectFilter(opt)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 0,
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#1E3A8A' : '#334155',
                              backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                              <span>{formatEnum(opt)}</span>
                            </div>
                            {isSelected && <Check size={14} color="#1E3A8A" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter 4: Topic Focus */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Topic Focus
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'topic' ? null : 'topic');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: activeDropdown === 'topic' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'topic' ? '#FFFFFF' : '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 600, outline: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: activeDropdown === 'topic' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedTopicsList.length === 0
                    ? 'All Topics'
                    : selectedTopicsList.length === 1
                      ? formatEnum(selectedTopicsList[0])
                      : `${selectedTopicsList.length} Topics Selected`}
                </span>
                <ChevronDown
                  size={14}
                  color="#64748B"
                  style={{
                    transform: activeDropdown === 'topic' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0
                  }}
                />
              </button>

              {activeDropdown === 'topic' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 260,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 0,
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 10,
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                    <button type="button" onClick={selectAllTopics} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => toggleTopicFilter('All Topics')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search topic..."
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
                    {availableTopicsList
                      .filter((t: string) => t.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                      .map((opt: string) => {
                        const isSelected = selectedTopicsList.includes(opt);
                        return (
                          <div
                            key={opt}
                            onClick={() => toggleTopicFilter(opt)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 0,
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#1E3A8A' : '#334155',
                              backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                              <span>{formatEnum(opt)}</span>
                            </div>
                            {isSelected && <Check size={14} color="#1E3A8A" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter 5: Subtopic Focus */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Subtopic Focus
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'subtopic' ? null : 'subtopic');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: activeDropdown === 'subtopic' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'subtopic' ? '#FFFFFF' : '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 600, outline: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: activeDropdown === 'subtopic' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedSubtopicsList.length === 0
                    ? 'All Subtopics'
                    : selectedSubtopicsList.length === 1
                      ? formatEnum(selectedSubtopicsList[0])
                      : `${selectedSubtopicsList.length} Subtopics Selected`}
                </span>
                <ChevronDown
                  size={14}
                  color="#64748B"
                  style={{
                    transform: activeDropdown === 'subtopic' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0
                  }}
                />
              </button>

              {activeDropdown === 'subtopic' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 270,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 0,
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 10,
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                    <button type="button" onClick={selectAllSubtopics} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => toggleSubtopicFilter('All Subtopics')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search subtopic..."
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
                    {availableSubtopicsList
                      .filter((st: string) => st.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                      .map((opt: string) => {
                        const isSelected = selectedSubtopicsList.includes(opt);
                        return (
                          <div
                            key={opt}
                            onClick={() => toggleSubtopicFilter(opt)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 0,
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#1E3A8A' : '#334155',
                              backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#1E3A8A' }} />
                              <span>{formatEnum(opt)}</span>
                            </div>
                            {isSelected && <Check size={14} color="#1E3A8A" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter 6: Difficulty */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Difficulty
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'difficulty' ? null : 'difficulty');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 0,
                  border: activeDropdown === 'difficulty' ? '1px solid #1E3A8A' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'difficulty' ? '#FFFFFF' : '#FAFAFC',
                  color: '#172033', fontSize: 13, fontWeight: 600, outline: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: activeDropdown === 'difficulty' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedDifficulty ? formatEnum(selectedDifficulty) : 'All Levels'}
                </span>
                <ChevronDown
                  size={14}
                  color="#64748B"
                  style={{
                    transform: activeDropdown === 'difficulty' ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0
                  }}
                />
              </button>

              {activeDropdown === 'difficulty' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 180,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 0,
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 6,
                    zIndex: 100,
                  }}
                >
                  {['All Levels', 'EASY', 'MEDIUM', 'HARD'].map((opt) => {
                    const isSelected = selectedDifficulty === opt;
                    return (
                      <div
                        key={opt}
                        onClick={() => {
                          setSelectedDifficulty(opt);
                          setActiveDropdown(null);
                        }}
                        style={{
                          padding: '9px 12px',
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
                      >
                        <span>{opt === 'All Levels' ? 'All Levels' : formatEnum(opt)}</span>
                        {isSelected && <Check size={14} color="#1E3A8A" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CTA Button Row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 20, borderTop: '1px dashed #E2E8F0', flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {selectedSubjectsList.length > 0 && (
                <span>
                  <strong>{selectedSubjectsList.length}</strong> subject{selectedSubjectsList.length > 1 ? 's' : ''} filtered
                  {selectedTopicsList.length > 0 && ` • ${selectedTopicsList.length} topic${selectedTopicsList.length > 1 ? 's' : ''}`}
                  {selectedSubtopicsList.length > 0 && ` • ${selectedSubtopicsList.length} subtopic${selectedSubtopicsList.length > 1 ? 's' : ''}`}
                </span>
              )}
            </div>
            <button
              type="submit"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 0,
                background: 'linear-gradient(135deg, #4F46E5 0%, var(--primary-red) 100%)',
                color: '#FFFFFF', fontWeight: 700, fontSize: 14, border: 'none',
                cursor: 'pointer', boxShadow: '0 4px 14px rgba(var(--primary-red-rgb), 0.35)',
                transition: 'transform 0.15s ease, boxShadow 0.15s ease',
              }}
            >
              <PlayCircle size={18} fill="#FFFFFF" color="var(--primary-red)" />
              <span>Start Practice Test</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </section>

      {/* Full-Length & Curated Test Series Section (Code preserved, hidden from UI) */}
      {false && (
      <>
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
            color: 'var(--primary-red)',
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
                  border: `1px solid ${hoveredMock === mock.id ? 'var(--primary-red)' : isCompleted ? '#A7F3D0' : '#E2E8F0'}`,
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
                      color: 'var(--primary-red)',
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
                        backgroundColor: 'var(--primary-red)',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: 13,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxSizing: 'border-box',
                        boxShadow: '0 2px 6px rgba(var(--primary-red-rgb), 0.25)'
                      }}
                    >
                      <PlayCircle size={15} fill="#FFFFFF" color="var(--primary-red)" /> Start Test
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </StudentLayout>
  );
}
