import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StudentLayout } from '../components/student/StudentLayout';
import {
  listExams,
  getAttemptStatusByExam,
  formatCanonicalExamTitle,
  fetchMasterSyllabus,
  fetchExamsByYear,
  listCandidateAttempts,
  getExamAttemptStatus,
} from '../services/examService';
import { guardedFetch } from '../utils/apiGuard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatEnum, extractCanonicalExamName } from '../utils/formatEnum';
import { formatTaxonomyParam } from '../utils/taxonomyParam';
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
  Target,
  Trophy,
  Crown,
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

  // Dynamic 3-level taxonomy & exam state
  const [masterSyllabus, setMasterSyllabus] = useState<any>(null);
  const [availableExams, setAvailableExams] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState<boolean>(true);

  // Form selections matching StudentPracticeExamPage
  const [selectedExam, setSelectedExam] = useState<string>('UPSC CSE');
  const [selectedExamsList, setSelectedExamsList] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedYearsList, setSelectedYearsList] = useState<string[]>([]);
  const [selectedSubjectsList, setSelectedSubjectsList] = useState<string[]>([]);
  const [selectedTopicsList, setSelectedTopicsList] = useState<string[]>([]);
  const [selectedSubtopicsList, setSelectedSubtopicsList] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All Levels');

  // Resume banner, weak-area & recent-attempt insights (below the builder form)
  const [resumeAttempt, setResumeAttempt] = useState<any>(null);
  const [isResumeLoading, setIsResumeLoading] = useState<boolean>(true);
  const [subjectPerformance, setSubjectPerformance] = useState<any[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [isInsightsLoading, setIsInsightsLoading] = useState<boolean>(true);

  // Popover state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close active dropdown on click outside
  // Close active dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [allYearsData, setAllYearsData] = useState<any>(null);

  // Fetch Global Data (Exams by year, Published exams)
  useEffect(() => {
    async function loadGlobalData() {
      setIsTaxonomyLoading(true);
      try {
        const [yearsData, publishedExams] = await Promise.all([
          fetchExamsByYear().catch(() => null),
          listExams('PUBLISHED').catch(() => []),
        ]);

        if (yearsData) {
          setAllYearsData(yearsData);
        }

        const dynamicExams: string[] = [];
        if (Array.isArray(publishedExams) && publishedExams.length > 0) {
          publishedExams.forEach((e: any) => {
            if (e.is_mixed_bank) return; // skip question banks
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
        console.warn('Exam years fetch warning:', err);
      } finally {
        setIsTaxonomyLoading(false);
      }
    }
    loadGlobalData();
  }, []);

  // Filter years based on selectedExamsList and update yearOptions
  useEffect(() => {
    if (allYearsData && Array.isArray(allYearsData.years) && allYearsData.years.length > 0) {
      let filteredYears = allYearsData.years;
      
      // If specific exams are selected, filter years to those exams
      if (selectedExamsList.length > 0) {
        const canonicalExams = selectedExamsList.map(extractCanonicalExamName);
        filteredYears = allYearsData.years.filter((y: number) => {
          const examsInYear = allYearsData.exams_by_year[String(y)] || [];
          return examsInYear.some((e: any) => 
            canonicalExams.includes(extractCanonicalExamName(e.name || e.code))
          );
        });
      }

      if (filteredYears.length > 0) {
        const sorted = [...filteredYears].sort((a, b) => b - a);
        const fetchedYears = sorted.map((y: number) => `${y} PYQs`);
        const minYear = Math.min(...filteredYears);
        const maxYear = Math.max(...filteredYears);
        const yearsArray = ['All Years', ...fetchedYears];
        setYearOptions(yearsArray);
        setSelectedYear((prev) => (prev && yearsArray.includes(prev) ? prev : yearsArray[0]));
      } else {
        const fallback = ['All Years'];
        setYearOptions(fallback);
        setSelectedYear(fallback[0]);
      }
    }
  }, [allYearsData, selectedExamsList]);

  // Fetch Taxonomy specifically for selectedExamsList
  useEffect(() => {
    async function loadTaxonomy() {
      try {
        // If one exam is selected, fetch taxonomy for that exam. Otherwise fetch all.
        const examParam = selectedExamsList.length === 1 ? extractCanonicalExamName(selectedExamsList[0]) : undefined;
        const taxData = await fetchMasterSyllabus(undefined, examParam).catch(() => null);
        if (taxData) {
          setMasterSyllabus(taxData);
        } else {
          setMasterSyllabus(null);
        }
      } catch (err) {
        console.warn('Taxonomy fetch warning:', err);
      }
    }
    loadTaxonomy();
  }, [selectedExamsList]);

  // Live mocks and student attempt status
  useEffect(() => {
    async function fetchLiveMocksAndAttempts() {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        const [liveExams, statusByExam] = await Promise.all([
          listExams(undefined, true, token || undefined),
          getAttemptStatusByExam(token || undefined),
        ]);

        const mocks = liveExams.filter(
          (e) => e.is_active === true && (e.exam_type === 'STATIC_MOCK' || e.exam_type === 'QuestionSourceType.STATIC_MOCK')
        );

        const targetList = mocks.length > 0 ? mocks : liveExams.filter((e) => e.is_active === true && !(e as any).is_mixed_bank);

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

  // Resume banner — most recent in-progress attempt (any exam type)
  useEffect(() => {
    async function loadResumeAttempt() {
      setIsResumeLoading(true);
      try {
        const inProgress = await listCandidateAttempts({ status: 'IN_PROGRESS', limit: 1 });
        if (inProgress.length > 0) {
          const status = await getExamAttemptStatus(inProgress[0].attempt_id);
          setResumeAttempt(status);
        } else {
          setResumeAttempt(null);
        }
      } catch (err) {
        console.warn('Failed to load resume attempt:', err);
        setResumeAttempt(null);
      } finally {
        setIsResumeLoading(false);
      }
    }
    loadResumeAttempt();
  }, []);

  // Weak-area & recent-attempt insights (same endpoints as the student dashboard)
  useEffect(() => {
    async function loadInsights() {
      setIsInsightsLoading(true);
      try {
        const token = localStorage.getItem('access_token');
        const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const [statsRes, subjectRes] = await Promise.allSettled([
          guardedFetch('/api/v1/attempts/student-dashboard-stats', { headers: authHeaders }).then((r) => (r.ok ? r.json() : null)),
          guardedFetch('/api/v1/analytics/subject-performance', { headers: authHeaders }).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (statsRes.status === 'fulfilled' && Array.isArray(statsRes.value?.recentAttempts)) {
          const registered = statsRes.value.recentAttempts.filter((a: any) => !a.isGuestSynced);
          setRecentAttempts(registered.slice(0, 5));
        }
        if (subjectRes.status === 'fulfilled' && Array.isArray(subjectRes.value)) {
          setSubjectPerformance(subjectRes.value);
        }
      } catch (err) {
        console.warn('Failed to load practice insights:', err);
      } finally {
        setIsInsightsLoading(false);
      }
    }
    loadInsights();
  }, []);

  // Weakest subjects (lowest accuracy first) — powers "Focus on these next" and coverage
  const weakSubjects = useMemo(() => {
    return subjectPerformance
      .filter((s: any) => s.total_attempted > 0)
      .sort((a: any, b: any) => a.accuracy - b.accuracy)
      .slice(0, 3);
  }, [subjectPerformance]);

  const maxSubjectAttempts = useMemo(() => {
    return subjectPerformance.reduce((max: number, s: any) => Math.max(max, s.total_attempted || 0), 0);
  }, [subjectPerformance]);

  // Starts a practice test scoped to a single subject, reusing the same query-param
  // contract as handleStartPracticeTest below — does not touch the builder form's state.
  const startPracticeFor = (subject: string) => {
    const queryParams = new URLSearchParams();
    if (selectedExamsList.length > 0) {
      queryParams.set('exam', selectedExamsList.join(','));
    } else if (selectedExam) {
      queryParams.set('exam', selectedExam);
    }
    if (selectedYearsList.length > 0) {
      queryParams.set('year', formatTaxonomyParam(selectedYearsList));
    } else if (yearOptions.length > 0) {
      queryParams.set('year', yearOptions[0]);
    } else if (selectedYear) {
      queryParams.set('year', selectedYear);
    }
    queryParams.set('subject', subject);
    navigate(`/practice-exam?${queryParams.toString()}`);
  };

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
  const toggleExamFilter = (examName: string) => {
    if (examName === 'All Exams') {
      setSelectedExamsList([]);
    } else {
      let updated: string[];
      if (selectedExamsList.includes(examName)) {
        updated = selectedExamsList.filter((e) => e !== examName);
      } else {
        updated = [...selectedExamsList, examName];
      }
      setSelectedExamsList(updated);
    }
  };

  const selectAllExams = () => {
    setSelectedExamsList([...(availableExams)]);
  };

  const toggleYearFilter = (yearName: string) => {
    if (yearName.startsWith('All Years') || yearName === 'All Years') {
      setSelectedYearsList([]);
    } else {
      let updated: string[];
      if (selectedYearsList.includes(yearName)) {
        updated = selectedYearsList.filter((y) => y !== yearName);
      } else {
        updated = [...selectedYearsList, yearName];
      }
      setSelectedYearsList(updated);
    }
  };

  const selectAllYears = () => {
    const individualYears = yearOptions.filter((y) => !y.startsWith('All Years'));
    setSelectedYearsList([...individualYears]);
  };

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

    // Support multi-select exams
    if (selectedExamsList.length > 0) {
      queryParams.set('exam', selectedExamsList.join(','));
    } else if (selectedExam) {
      queryParams.set('exam', selectedExam);
    }
    if (selectedYearsList.length > 0) {
      queryParams.set('year', formatTaxonomyParam(selectedYearsList));
    } else if (yearOptions.length > 0) {
      queryParams.set('year', yearOptions[0]);
    } else if (selectedYear) {
      queryParams.set('year', selectedYear);
    }
    if (selectedSubjectsList.length > 0) {
      queryParams.set('subject', formatTaxonomyParam(selectedSubjectsList));
    }
    if (selectedTopicsList.length > 0) {
      queryParams.set('topic', formatTaxonomyParam(selectedTopicsList));
    }
    if (selectedSubtopicsList.length > 0) {
      queryParams.set('subtopic', formatTaxonomyParam(selectedSubtopicsList));
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
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid #E5E7EB',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius)',
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg-card)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>
            <Zap size={22} fill="var(--bg-card)" color="var(--bg-card)" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--deep-navy)', margin: 0 }}>
              Instant Practice Test Generator
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Select your target subject, topic, and subtopic to launch a custom practice test.
            </p>
          </div>
        </div>

        <form onSubmit={handleStartPracticeTest}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Filter 1: Target Exam (multi-select) */}
            <div style={{ position: 'relative' }} data-dropdown-container>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Target Exam
              </label>
              {/* --- Multi-select Exam Dropdown --- */}
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'exam' ? null : 'exam');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 'var(--radius)',
                  border: activeDropdown === 'exam' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'exam' ? '#FFFFFF' : '#FAFAFC',
                  color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, outline: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: activeDropdown === 'exam' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedExamsList.length === 0
                    ? 'All Exams'
                    : selectedExamsList.length === 1
                      ? selectedExamsList[0]
                      : `${selectedExamsList.length} Exams Selected`}
                </span>
                <ChevronDown
                  size={14}
                  color="var(--text-muted)"
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
                    width: 240,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 10,
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                    <button type="button" onClick={selectAllExams} style={{ background: 'none', border: 'none', color: 'var(--primary-red)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => toggleExamFilter('All Exams')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>

                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* All Exams default */}
                    <div
                      onClick={() => toggleExamFilter('All Exams')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius)',
                        fontSize: 12.5,
                        fontWeight: selectedExamsList.length === 0 ? 700 : 500,
                        color: selectedExamsList.length === 0 ? 'var(--primary-red)' : '#334155',
                        backgroundColor: selectedExamsList.length === 0 ? '#F1F5F9' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selectedExamsList.length === 0}
                          onChange={() => {}}
                          style={{ cursor: 'pointer', accentColor: 'var(--primary-red)' }}
                        />
                        <span>All Exams</span>
                      </div>
                      {selectedExamsList.length === 0 && <Check size={14} color="var(--primary-red)" />}
                    </div>

                    {/* Individual exam options */}
                    {(availableExams).map((opt) => {
                      const isSelected = selectedExamsList.includes(opt);
                      return (
                        <div
                          key={opt}
                          onClick={() => toggleExamFilter(opt)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 'var(--radius)',
                            fontSize: 12.5,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--primary-red)' : '#334155',
                            backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ cursor: 'pointer', accentColor: 'var(--primary-red)' }}
                            />
                            <span>{opt}</span>
                          </div>
                          {isSelected && <Check size={14} color="var(--primary-red)" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter 2: Target / PYQ Year */}
            <div style={{ position: 'relative' }} data-dropdown-container>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Target / PYQ Year
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'year' ? null : 'year');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 'var(--radius)',
                  border: activeDropdown === 'year' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'year' ? '#FFFFFF' : '#FAFAFC',
                  color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, outline: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: activeDropdown === 'year' ? '0 0 0 3px rgba(23, 32, 51, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedYearsList.length === 0
                    ? (yearOptions[0] || 'All Years')
                    : selectedYearsList.length === 1
                      ? selectedYearsList[0]
                      : `${selectedYearsList.length} Years Selected`}
                </span>
                <ChevronDown
                  size={14}
                  color="var(--text-muted)"
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
                    width: 250,
                    maxWidth: 'calc(100vw - 32px)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 10,
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                    <button type="button" onClick={selectAllYears} style={{ background: 'none', border: 'none', color: 'var(--primary-red)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => toggleYearFilter('All Years')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                    <Search size={14} color="var(--text-disabled)" style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search year..."
                      value={filterSearchQuery}
                      onChange={(e) => setFilterSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px 7px 30px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--bg-subtle)',
                      }}
                    />
                  </div>

                  <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* All Years default option */}
                    {(yearOptions[0] || 'All Years').toLowerCase().includes(filterSearchQuery.toLowerCase()) && (
                      <div
                        onClick={() => toggleYearFilter('All Years')}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius)',
                          fontSize: 12.5,
                          fontWeight: selectedYearsList.length === 0 ? 700 : 500,
                          color: selectedYearsList.length === 0 ? 'var(--primary-red)' : '#334155',
                          backgroundColor: selectedYearsList.length === 0 ? '#F1F5F9' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={selectedYearsList.length === 0}
                            onChange={() => {}}
                            style={{ cursor: 'pointer', accentColor: 'var(--primary-red)' }}
                          />
                          <span>{yearOptions[0] || 'All Years'}</span>
                        </div>
                        {selectedYearsList.length === 0 && <Check size={14} color="var(--primary-red)" />}
                      </div>
                    )}

                    {/* Individual year options */}
                    {yearOptions
                      .filter((y) => !y.startsWith('All Years') && y.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                      .map((opt: string) => {
                        const isSelected = selectedYearsList.includes(opt);
                        return (
                          <div
                            key={opt}
                            onClick={() => toggleYearFilter(opt)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius)',
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? 'var(--primary-red)' : '#334155',
                              backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ cursor: 'pointer', accentColor: 'var(--primary-red)' }}
                              />
                              <span>{opt}</span>
                            </div>
                            {isSelected && <Check size={14} color="var(--primary-red)" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter 3: Subject Focus */}
            <div style={{ position: 'relative' }} data-dropdown-container>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Subject Focus
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'subject' ? null : 'subject');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 'var(--radius)',
                  border: activeDropdown === 'subject' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'subject' ? '#FFFFFF' : '#FAFAFC',
                  color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, outline: 'none',
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
                  color="var(--text-muted)"
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
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 10,
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                    <button type="button" onClick={selectAllSubjects} style={{ background: 'none', border: 'none', color: 'var(--primary-red)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => toggleSubjectFilter('All Subjects')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                    <Search size={14} color="var(--text-disabled)" style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search subject..."
                      value={filterSearchQuery}
                      onChange={(e) => setFilterSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px 7px 30px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--bg-subtle)',
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
                              borderRadius: 'var(--radius)',
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? 'var(--primary-red)' : '#334155',
                              backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--primary-red)' }} />
                              <span>{formatEnum(opt)}</span>
                            </div>
                            {isSelected && <Check size={14} color="var(--primary-red)" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter 4: Topic Focus */}
            <div style={{ position: 'relative' }} data-dropdown-container>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Topic Focus
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'topic' ? null : 'topic');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 'var(--radius)',
                  border: activeDropdown === 'topic' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'topic' ? '#FFFFFF' : '#FAFAFC',
                  color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, outline: 'none',
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
                  color="var(--text-muted)"
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
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 10,
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                    <button type="button" onClick={selectAllTopics} style={{ background: 'none', border: 'none', color: 'var(--primary-red)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => toggleTopicFilter('All Topics')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                    <Search size={14} color="var(--text-disabled)" style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search topic..."
                      value={filterSearchQuery}
                      onChange={(e) => setFilterSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px 7px 30px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--bg-subtle)',
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
                              borderRadius: 'var(--radius)',
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? 'var(--primary-red)' : '#334155',
                              backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--primary-red)' }} />
                              <span>{formatEnum(opt)}</span>
                            </div>
                            {isSelected && <Check size={14} color="var(--primary-red)" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter 5: Subtopic Focus */}
            <div style={{ position: 'relative' }} data-dropdown-container>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Subtopic Focus
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'subtopic' ? null : 'subtopic');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 'var(--radius)',
                  border: activeDropdown === 'subtopic' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'subtopic' ? '#FFFFFF' : '#FAFAFC',
                  color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, outline: 'none',
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
                  color="var(--text-muted)"
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
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
                    padding: 10,
                    zIndex: 100,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #F1F5F9' }}>
                    <button type="button" onClick={selectAllSubtopics} style={{ background: 'none', border: 'none', color: 'var(--primary-red)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Select All</button>
                    <button type="button" onClick={() => toggleSubtopicFilter('All Subtopics')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                  </div>

                  <div style={{ position: 'relative', marginBottom: 8 }} data-dropdown-container>
                    <Search size={14} color="var(--text-disabled)" style={{ position: 'absolute', left: 10, top: 10 }} />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search subtopic..."
                      value={filterSearchQuery}
                      onChange={(e) => setFilterSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px 7px 30px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: 'var(--bg-subtle)',
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
                              borderRadius: 'var(--radius)',
                              fontSize: 12.5,
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? 'var(--primary-red)' : '#334155',
                              backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', accentColor: 'var(--primary-red)' }} />
                              <span>{formatEnum(opt)}</span>
                            </div>
                            {isSelected && <Check size={14} color="var(--primary-red)" />}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Filter 6: Difficulty */}
            <div style={{ position: 'relative' }} data-dropdown-container>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Difficulty
              </label>
              <button
                type="button"
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'difficulty' ? null : 'difficulty');
                  setFilterSearchQuery('');
                }}
                style={{
                  width: '100%', height: 42, padding: '0 14px', borderRadius: 'var(--radius)',
                  border: activeDropdown === 'difficulty' ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                  backgroundColor: activeDropdown === 'difficulty' ? '#FFFFFF' : '#FAFAFC',
                  color: 'var(--deep-navy)', fontSize: 13, fontWeight: 600, outline: 'none',
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
                  color="var(--text-muted)"
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
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid #E2E8F0',
                    borderRadius: 'var(--radius)',
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
                          borderRadius: 'var(--radius)',
                          fontSize: 12.5,
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? 'var(--primary-red)' : '#334155',
                          backgroundColor: isSelected ? '#F8FAFC' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{opt === 'All Levels' ? 'All Levels' : formatEnum(opt)}</span>
                        {isSelected && <Check size={14} color="var(--primary-red)" />}
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
                padding: '12px 24px', borderRadius: 'var(--radius)',
                background: 'linear-gradient(135deg, #4F46E5 0%, var(--primary-red) 100%)',
                color: 'var(--bg-card)', fontWeight: 700, fontSize: 14, border: 'none',
                cursor: 'pointer', boxShadow: '0 4px 14px rgba(var(--primary-red-rgb), 0.35)',
                transition: 'transform 0.15s ease, boxShadow 0.15s ease',
              }}
            >
              <PlayCircle size={18} fill="var(--bg-card)" color="var(--primary-red)" />
              <span>Start Practice Test</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </section>


      {/* Weak areas + Recent attempts */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: 24,
          marginBottom: 28,
        }}
      >
        {/* Focus on these next */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid #E5E7EB',
            borderRadius: 'var(--radius)',
            padding: '22px 24px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Target size={17} color="var(--primary-red)" />
            <h2 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--deep-navy)', margin: 0 }}>
              Focus on these next
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            Your lowest-scoring subjects. Tap one to start practising it.
          </p>

          {isInsightsLoading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading your weak areas...
            </div>
          ) : weakSubjects.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: 13 }}>
              Attempt a few questions to see your weak areas here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weakSubjects.map((w: any) => {
                const acc = Math.round(w.accuracy || 0);
                const status = acc >= 70 ? 'high-accuracy' : acc >= 40 ? 'moderate-accuracy' : 'low-accuracy';
                return (
                  <button
                    key={w.subject}
                    type="button"
                    onClick={() => startPracticeFor(w.subject)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 14px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--bg-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)' }}>
                        {formatEnum(w.subject)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                        {w.total_correct} of {w.total_attempted} correct
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
                      <StatusBadge status={status} label={`${acc}%`} size="sm" />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary-red)' }}>Start</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent attempts */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid #E5E7EB',
            borderRadius: 'var(--radius)',
            padding: '22px 24px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Trophy size={17} color="var(--primary-red)" />
            <h2 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--deep-navy)', margin: 0 }}>
              Recent attempts
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            Your latest practice sessions.
          </p>

          {isInsightsLoading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading recent attempts...
            </div>
          ) : recentAttempts.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: 13 }}>
              No attempts recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentAttempts.map((a: any, idx: number) => {
                const acc = Math.round(a.accuracy || 0);
                const status = acc >= 70 ? 'high-accuracy' : acc >= 40 ? 'moderate-accuracy' : 'low-accuracy';
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/analytics?attemptId=${a.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 4px',
                      borderTop: idx === 0 ? 'none' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--deep-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.topicName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                        {a.targetExam} &middot; {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--deep-navy)' }}>
                        {a.score}/{a.totalMarksPossible}
                      </div>
                      <StatusBadge status={status} label={`${acc}%`} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Subject practice coverage */}
      <section
        style={{
          marginBottom: 28,
          padding: '22px 24px',
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid #E5E7EB',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <BarChart2 size={17} color="var(--primary-red)" />
          <h2 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--deep-navy)', margin: 0 }}>
            Subject practice coverage
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
          Questions attempted per subject, relative to your most-practised subject. Tap a subject to practise it.
        </p>

        {isInsightsLoading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading coverage...
          </div>
        ) : subjectPerformance.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: 13 }}>
            No subjects attempted yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...subjectPerformance]
              .sort((a: any, b: any) => (b.total_attempted || 0) - (a.total_attempted || 0))
              .map((s: any) => {
                const attempted = s.total_attempted || 0;
                const pct = maxSubjectAttempts > 0 ? Math.round((attempted / maxSubjectAttempts) * 100) : 0;
                return (
                  <button
                    key={s.subject}
                    type="button"
                    onClick={() => startPracticeFor(s.subject)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '140px 1fr 90px',
                      gap: 12,
                      alignItems: 'center',
                      padding: '8px 6px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--deep-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatEnum(s.subject)}
                    </span>
                    <span style={{ height: 10, borderRadius: 5, backgroundColor: 'var(--bg-subtle)', overflow: 'hidden', display: 'block' }}>
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width: `${Math.max(attempted > 0 ? 4 : 0, pct)}%`,
                          borderRadius: 5,
                          background: 'linear-gradient(90deg, var(--primary-red), #8B7CFF)',
                        }}
                      />
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>
                      {attempted} attempted
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </section>

      {/* PRO teaser */}
      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 36,
          padding: '22px 24px',
          borderRadius: 'var(--radius)',
          background: '#111111',
          border: '1px solid #F2B623',
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 'var(--radius)',
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(242, 182, 35, 0.12)',
          }}
        >
          <Crown size={22} color="#F2B623" />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F2B623', fontWeight: 800, fontSize: 15 }}>
            Where you lose marks
            <span style={{ fontSize: 10.5, fontWeight: 800, background: '#F2B623', color: '#141C31', padding: '2px 8px', borderRadius: 6, letterSpacing: '0.02em' }}>
              PRO
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'rgba(255, 255, 255, 0.7)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
            AI insights read your recent attempts and point out the patterns behind your wrong answers — unlock deeper analytics and unlimited practice tests.
          </p>
        </div>
        <Link
          to="/billing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            height: 42,
            padding: '0 18px',
            borderRadius: 'var(--radius)',
            border: '1px solid #F2B623',
            backgroundColor: 'transparent',
            color: '#F2B623',
            fontWeight: 700,
            fontSize: 13.5,
            textDecoration: 'none',
            flex: 'none',
          }}
        >
          <Crown size={15} /> Explore PRO
        </Link>
      </section>

      {/* Full-Length & Curated Test Series Section (Code preserved, hidden from UI) */}
      {false && (
      <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--deep-navy)', margin: 0 }}>
            Full-Length & Curated Test Series
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
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
            borderRadius: 'var(--radius)',
            border: '1px solid #F8FAFC',
            backgroundColor: 'var(--bg-subtle)',
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
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
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
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${hoveredMock === mock.id ? 'var(--primary-red)' : isCompleted ? '#A7F3D0' : 'var(--border-color)'}`,
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
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--bg-subtle)',
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
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--deep-navy)', margin: '0 0 8px 0' }}>
                    {mock.title}
                  </h3>

                  {/* Questions & Duration */}
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {mock.totalQuestions} Questions &nbsp;•&nbsp; {mock.duration}
                  </div>

                  {/* In Progress: Progress Bar */}
                  {isInProgress && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#EA580C', marginBottom: 6 }}>
                        <span>65% Completed</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-hover)', overflow: 'hidden' }}>
                        <div style={{ width: '65%', height: '100%', backgroundColor: '#F47B35', borderRadius: 'var(--radius)' }} />
                      </div>
                    </div>
                  )}

                  {/* Completed: Score Badge */}
                  {isCompleted && (
                    <div style={{ marginTop: 10, padding: '4px 10px', backgroundColor: '#ECFDF5', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 700, color: '#3A8B53', display: 'inline-block' }}>
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
                        borderRadius: 'var(--radius)',
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
                          borderRadius: 'var(--radius)',
                          backgroundColor: '#3A8B53',
                          color: 'var(--bg-card)',
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
                        <PlayCircle size={15} fill="var(--bg-card)" color="#3A8B53" /> Retake Test
                      </Link>

                      <Link
                        to={`/analytics?attemptId=${mock.completedAttemptId || mock.id}`}
                        style={{
                          padding: '0 16px',
                          height: 40,
                          borderRadius: 'var(--radius)',
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid #E2E8F0',
                          color: 'var(--text-secondary)',
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
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'var(--primary-red)',
                        color: 'var(--bg-card)',
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
                      <PlayCircle size={15} fill="var(--bg-card)" color="var(--primary-red)" /> Start Test
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
