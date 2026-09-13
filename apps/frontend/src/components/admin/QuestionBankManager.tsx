import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  ArrowLeft,
  CheckCircle2,
  Tag,
  Loader2,
  ChevronRight,
  FileText,
  Scale,
  TrendingUp,
  Landmark,
  Globe,
  Cpu,
  TreePine,
  Newspaper,
  Sprout,
  Check,
  ChevronLeft,
  X,
  AlertTriangle,
  HelpCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  Copy,
  Filter,
  Calendar,
  Layers,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import {
  fetchCatalogQuestions,
  fetchQuestionCatalogSubjects,
  QuestionCatalogSubjectItem,
} from '../../services/adminService';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { AdminQuestionPublicationCard } from './AdminQuestionPublicationCard';

interface QuestionOptionItem {
  option_id?: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  display_order?: number;
  distractor_analysis?: string | null;
  why_tempting?: string | null;
  whats_actually_true?: string | null;
}

interface QuestionCatalogItem {
  id: string;
  question_number_in_paper: number;
  question_type: string;
  difficulty: string;
  marks: number;
  status: string;
  question_text: string;
  passage_text?: string;
  exam_name?: string;
  exam_code?: string;
  exam_id?: string | number;
  source_year?: number;
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
  subtopic_code?: string;
  options: QuestionOptionItem[];
  explanation?: {
    core_concept?: string;
    detailed_solution?: string;
  };
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  query_name: string;
  icon: any;
  description: string;
  questionsCount: number;
  pendingCount: number;
  subtopicsCount: number;
}

export interface QuestionBankManagerProps {
  onNavigate?: (view: string, extraData?: any) => void;
}

// ----------------------------------------------------------------------
// Icon Mapper for Dynamic Subjects
// ----------------------------------------------------------------------
function getSubjectIcon(code: string, name: string): any {
  const lowerName = name.toLowerCase();
  const lowerCode = code.toLowerCase();
  if (lowerName.includes('polity') || lowerCode.includes('polity')) return Scale;
  if (lowerName.includes('economy') || lowerCode.includes('economy')) return TrendingUp;
  if (lowerName.includes('history') || lowerCode.includes('history')) return Landmark;
  if (lowerName.includes('geography') || lowerCode.includes('geography')) return Globe;
  if (lowerName.includes('science') || lowerCode.includes('science')) return Cpu;
  if (lowerName.includes('environment') || lowerCode.includes('environment')) return TreePine;
  if (lowerName.includes('current') || lowerName.includes('international') || lowerCode.includes('current')) return Newspaper;
  if (lowerName.includes('agriculture') || lowerCode.includes('agri')) return Sprout;
  return BookOpen;
}

// ----------------------------------------------------------------------
// Reusable Explore Button with Smooth Hover Micro-Interaction
// ----------------------------------------------------------------------
function ExploreButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        fontSize: 12.5,
        fontWeight: 600,
        color: isHovered ? 'var(--primary-red)' : '#172033',
        backgroundColor: isHovered ? '#F8FAFC' : '#FFFFFF',
        border: `1px solid ${isHovered ? 'var(--primary-red)' : '#CBD5E1'}`,
        borderRadius: 0,
        cursor: 'pointer',
        boxShadow: isHovered ? '0 2px 6px rgba(var(--primary-red-rgb), 0.15)' : 'none',
        transition: 'all 150ms ease-out',
      }}
    >
      <span>Explore</span>
      <ArrowRight
        size={14}
        style={{
          transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
          transition: 'transform 150ms ease-out',
          color: isHovered ? 'var(--primary-red)' : '#64748B',
        }}
      />
    </button>
  );
}

export function QuestionBankManager({ onNavigate }: QuestionBankManagerProps) {
  const { isMobile, isTabletOrBelow } = useBreakpoint();

  // Navigation State: null = Directory View, SubjectItem = Selected Subject
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);

  // Live Catalog Subjects State
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState<boolean>(true);
  const [totalSubjects, setTotalSubjects] = useState<number>(0);
  const [totalQuestionsSum, setTotalQuestionsSum] = useState<number>(0);
  const [totalSubtopicsSum, setTotalSubtopicsSum] = useState<number>(0);
  const [totalPendingSum, setTotalPendingSum] = useState<number>(0);

  // Subject Directory Search
  const [subjectSearchQuery, setSubjectSearchQuery] = useState<string>('');

  // Questions State for selected subject
  const [questions, setQuestions] = useState<QuestionCatalogItem[]>([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  // Mobile / Tablet Tab State: 'list' | 'preview'
  const [mobileExploreTab, setMobileExploreTab] = useState<'list' | 'preview'>('list');

  // Question Filters inside Explore Workspace
  const [questionSearchQuery, setQuestionSearchQuery] = useState<string>('');
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');

  // Debounced search queries (250ms)
  const [debouncedSubjectQuery, setDebouncedSubjectQuery] = useState<string>(subjectSearchQuery);
  const [debouncedQuestionQuery, setDebouncedQuestionQuery] = useState<string>(questionSearchQuery);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSubjectQuery(subjectSearchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [subjectSearchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuestionQuery(questionSearchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [questionSearchQuery]);

  // Load Real-Time Question Catalog Directory on Mount
  const loadCatalogDirectory = async () => {
    setLoadingSubjects(true);
    setErrorMsg('');
    try {
      const data = await fetchQuestionCatalogSubjects();
      const mapped: SubjectItem[] = (data.subjects || []).map((s: QuestionCatalogSubjectItem) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        query_name: s.query_name || s.name,
        icon: getSubjectIcon(s.code, s.name),
        description: s.description,
        questionsCount: s.questions_count,
        pendingCount: s.pending_count,
        subtopicsCount: s.subtopics_count,
      }));

      setSubjects(mapped);
      setTotalSubjects(data.total_subjects || mapped.length);
      setTotalQuestionsSum(data.total_questions || 0);
      setTotalSubtopicsSum(data.total_subtopics || 0);
      setTotalPendingSum(data.total_pending || 0);
    } catch (err: any) {
      console.error('Failed to load question catalog directory:', err);
      setErrorMsg(err.message || 'Could not load question catalog directory from server.');
    } finally {
      setLoadingSubjects(false);
    }
  };

  useEffect(() => {
    loadCatalogDirectory();
  }, []);

  // Load Questions when a Subject is Selected for Exploration
  useEffect(() => {
    if (selectedSubject) {
      loadQuestionsForSubject(selectedSubject.query_name || selectedSubject.name);
      setSelectedSubtopic('ALL');
      setSelectedYear('ALL');
      setSelectedDifficulty('ALL');
      setQuestionSearchQuery('');
      setSelectedQuestionIndex(0);
      setMobileExploreTab('list');
    }
  }, [selectedSubject]);

  const loadQuestionsForSubject = async (subjectQueryName: string) => {
    setLoadingQuestions(true);
    setErrorMsg('');
    try {
      const data = await fetchCatalogQuestions(1, 100, subjectQueryName);

      const mapped = (data.items || []).map((q: any, idx: number) => ({
        id: q.question_id || q.id,
        question_number_in_paper: q.question_number_in_paper || idx + 1,
        question_type: q.question_type || 'SINGLE_CHOICE',
        difficulty: q.difficulty || 'MEDIUM',
        marks: q.marks || 2.0,
        status: q.status || 'PUBLISHED',
        question_text: q.question_text || 'No question text stem available',
        passage_text: q.passage_text,
        exam_name: q.exam_name || 'UPSC CSE Prelims',
        exam_code: q.exam_code || 'UPSC_CSE',
        exam_id: q.exam_id,
        source_year: q.source_year || 2024,
        subject_name: q.subject_name || q.hierarchy?.[0]?.subject_name || selectedSubject?.name,
        topic_name: q.topic_name || q.hierarchy?.[0]?.topic_name || 'General Topic',
        subtopic_name: q.subtopic_name || q.hierarchy?.[0]?.subtopic_name || 'Core Concept',
        subtopic_code: q.subtopic_code || q.hierarchy?.[0]?.subtopic_code || 'SUB-01',
        options: (q.options || []).map((opt: any, optIdx: number) => ({
          option_id: opt.option_id || opt.id,
          option_label: opt.option_label || String.fromCharCode(65 + optIdx),
          option_text: opt.option_text || opt.text || '',
          is_correct: Boolean(opt.is_correct),
          display_order: opt.display_order || optIdx + 1,
          distractor_analysis: opt.distractor_analysis || null,
          why_tempting: opt.why_tempting || null,
          whats_actually_true: opt.whats_actually_true || null,
        })),
        explanation: {
          core_concept: q.core_concept || q.explanation?.core_concept,
          detailed_solution:
            q.explanation?.detailed_solution || (typeof q.explanation === 'string' ? q.explanation : ''),
        },
      }));

      setQuestions(mapped);
      setSelectedQuestionIndex(0);
    } catch (err: any) {
      console.error('Failed to load questions for subject:', err);
      setErrorMsg(err.message || 'Could not load questions from server.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Filtered Subject List for Directory Table
  const filteredSubjects = useMemo(() => {
    if (!debouncedSubjectQuery) return subjects;
    const term = debouncedSubjectQuery.toLowerCase();
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(term) || s.description.toLowerCase().includes(term)
    );
  }, [subjects, debouncedSubjectQuery]);

  // Distinct Subtopics breakdown for the selected subject's questions
  const subtopicCounts = useMemo(() => {
    const map: { [key: string]: number } = {};
    questions.forEach((q) => {
      const st = q.subtopic_name || 'General / Uncategorized';
      map[st] = (map[st] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [questions]);

  // Distinct Exam Years for selected subject's questions
  const yearCounts = useMemo(() => {
    const map: { [key: number]: number } = {};
    questions.forEach((q) => {
      if (q.source_year) {
        map[q.source_year] = (map[q.source_year] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([year, count]) => ({ year: parseInt(year, 10), count }))
      .sort((a, b) => b.year - a.year);
  }, [questions]);

  // Difficulty counts breakdown
  const difficultyCounts = useMemo(() => {
    let easy = 0;
    let medium = 0;
    let hard = 0;
    questions.forEach((q) => {
      const d = (q.difficulty || '').toUpperCase();
      if (d === 'EASY') easy++;
      else if (d === 'HARD') hard++;
      else medium++;
    });
    return { easy, medium, hard, total: questions.length };
  }, [questions]);

  // Filtered Questions in Explore Mode (debounced query, subtopic, year, difficulty)
  const filteredQuestions = useMemo(() => {
    const qTerm = debouncedQuestionQuery.toLowerCase();
    return questions.filter((q) => {
      const matchesSearch =
        !debouncedQuestionQuery ||
        q.question_text.toLowerCase().includes(qTerm) ||
        q.subtopic_name?.toLowerCase().includes(qTerm) ||
        q.question_number_in_paper.toString() === debouncedQuestionQuery;

      const matchesSubtopic =
        selectedSubtopic === 'ALL' || q.subtopic_name === selectedSubtopic;

      const matchesYear =
        selectedYear === 'ALL' || q.source_year?.toString() === selectedYear;

      const matchesDifficulty =
        selectedDifficulty === 'ALL' || (q.difficulty || '').toUpperCase() === selectedDifficulty;

      return matchesSearch && matchesSubtopic && matchesYear && matchesDifficulty;
    });
  }, [questions, debouncedQuestionQuery, selectedSubtopic, selectedYear, selectedDifficulty]);

  const selectedQuestion = filteredQuestions[selectedQuestionIndex] || filteredQuestions[0] || null;

  // Copy Question ID / Text Handler
  const handleCopyQuestionId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setToastMsg(`Question ID #${id} copied to clipboard!`);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Inspect in Reviewer Handler
  const handleOpenInReviewer = (q: QuestionCatalogItem) => {
    if (onNavigate && q.exam_id) {
      setToastMsg(`Opening Question #${q.question_number_in_paper} in Exam Reviewer...`);
      onNavigate('review', {
        id: q.exam_id,
        name: q.exam_name,
        code: q.exam_code,
        source_year: q.source_year,
        targetQuestionNumber: q.question_number_in_paper,
        targetQuestionId: q.id,
        _navTimestamp: Date.now(),
      });
    } else {
      handleCopyQuestionId(q.id);
      setToastMsg(`Question ID #${q.id} copied to clipboard. Open the Exam Review tab to inspect.`);
      setTimeout(() => setToastMsg(''), 4500);
    }
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60, width: '100%', boxSizing: 'border-box' }}>
      {/* Global Toast / Alerts */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECDCA',
            borderRadius: 0,
            marginBottom: 20,
            color: '#B42318',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={18} color="#B42318" />
          <span>{errorMsg}</span>
        </div>
      )}

      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            padding: '12px 20px',
            background: '#172033',
            color: '#FFFFFF',
            borderRadius: 0,
            zIndex: 9999,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <CheckCircle2 size={16} color="#86EFAC" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 1: SUBJECT DIRECTORY / CATALOG MANAGEMENT VIEW                   */}
      {/* ==================================================================== */}
      {!selectedSubject ? (
        <div>
          {/* Editorial Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <h1 style={{ fontSize: isMobile ? 24 : 30, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
                Question Bank
              </h1>
              <p style={{ fontSize: isMobile ? 13 : 14, color: '#64748B', marginTop: 4, margin: '4px 0 0 0' }}>
                Browse and review real-time questions organized by subject and mapped subtopics.
              </p>
              {/* Contextual Metadata Badge Line */}
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--primary-red)',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #BFDBFE',
                    padding: '3px 10px',
                    borderRadius: 0,
                  }}
                >
                  {loadingSubjects ? (
                    'Loading catalog statistics...'
                  ) : (
                    `${totalSubjects} Subjects · ${totalQuestionsSum.toLocaleString()} Questions · ${totalSubtopicsSum.toLocaleString()} Subtopics`
                  )}
                </span>
                <button
                  onClick={loadCatalogDirectory}
                  title="Refresh live catalog counts"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: '#64748B',
                    background: 'transparent',
                    border: '1px solid #CBD5E1',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={11} className={loadingSubjects ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Compact Search Field */}
            <div style={{ position: 'relative', width: isMobile ? '100%' : 280 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748B' }} />
              <input
                type="text"
                placeholder="Search subjects or domains..."
                value={subjectSearchQuery}
                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 0,
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13,
                  color: '#172033',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Premium Subject Catalog List Container */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 0,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: 680,
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 13.5,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    SUBJECT
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    DESCRIPTION
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    QUESTIONS
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    PENDING REVIEW
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>
                    SUBTOPICS
                  </th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em', textAlign: 'right' }}>
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingSubjects ? (
                  Array.from({ length: 7 }).map((_, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, backgroundColor: '#F1F5F9' }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ width: 90, height: 14, backgroundColor: '#F1F5F9' }} />
                            <div style={{ width: 60, height: 10, backgroundColor: '#F1F5F9' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}><div style={{ width: 220, height: 12, backgroundColor: '#F1F5F9' }} /></td>
                      <td style={{ padding: '16px' }}><div style={{ width: 50, height: 16, backgroundColor: '#F1F5F9' }} /></td>
                      <td style={{ padding: '16px' }}><div style={{ width: 80, height: 14, backgroundColor: '#F1F5F9' }} /></td>
                      <td style={{ padding: '16px' }}><div style={{ width: 70, height: 14, backgroundColor: '#F1F5F9' }} /></td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}><div style={{ width: 80, height: 28, backgroundColor: '#F1F5F9', marginLeft: 'auto' }} /></td>
                    </tr>
                  ))
                ) : filteredSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                      No subjects found matching "{debouncedSubjectQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredSubjects.map((sub, i) => {
                    const IconComponent = sub.icon;
                    return (
                      <tr
                        key={sub.id}
                        onClick={() => setSelectedSubject(sub)}
                        style={{
                          borderBottom: i < filteredSubjects.length - 1 ? '1px solid #F1F5F9' : 'none',
                          transition: 'background-color 150ms ease-out',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Subject Identity */}
                        <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#EFF6FF',
                                color: 'var(--primary-red)',
                                border: '1px solid #BFDBFE',
                                flexShrink: 0,
                              }}
                            >
                              <IconComponent size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#172033', fontSize: 14 }}>{sub.name}</div>
                              <div style={{ fontSize: 11.5, color: '#64748B' }}>{sub.subtopicsCount} subtopics</div>
                            </div>
                          </div>
                        </td>

                        {/* Description */}
                        <td style={{ padding: '16px', color: '#64748B', maxWidth: 360, lineHeight: 1.45, fontSize: 12.5 }}>
                          {sub.description}
                        </td>

                        {/* Question Count */}
                        <td style={{ padding: '16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 700, color: '#172033', fontSize: 14.5 }}>
                            {sub.questionsCount.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>questions</div>
                        </td>

                        {/* Pending Review Badge */}
                        <td style={{ padding: '16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {sub.pendingCount > 0 ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: '#B45309',
                                backgroundColor: '#FEF3C7',
                                border: '1px solid #FDE68A',
                                borderRadius: 0,
                                gap: 5,
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: '#F2B623' }} />
                              {sub.pendingCount} Pending Review
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: '#15803D',
                                backgroundColor: '#F0FDF4',
                                border: '1px solid #BBF7D0',
                                borderRadius: 0,
                                gap: 5,
                              }}
                            >
                              <Check size={12} color="#16A34A" />
                              All Verified
                            </span>
                          )}
                        </td>

                        {/* Subtopics */}
                        <td style={{ padding: '16px', color: '#475569', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {sub.subtopicsCount} Subtopics
                        </td>

                        {/* Explore Action Button */}
                        <td style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <ExploreButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubject(sub);
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ==================================================================== */
        /* MODE 2: RESPONSIVE READ-ONLY SUBJECT EXPLORATION & CURRICULUM WORKSPACE */
        /* ==================================================================== */
        <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
          {/* Header & Back Navigation Banner */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              border: '1px solid #E2E8F0',
              padding: isMobile ? '14px 16px' : '18px 22px',
              marginBottom: 16,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? 8 : 14,
                }}
              >
                <button
                  onClick={() => setSelectedSubject(null)}
                  style={{
                    padding: '7px 12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: 0,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    flexShrink: 0,
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Question Bank</span>
                </button>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h1
                      style={{
                        fontSize: isMobile ? 18 : 22,
                        fontWeight: 700,
                        color: '#172033',
                        margin: 0,
                        letterSpacing: '-0.015em',
                      }}
                    >
                      {selectedSubject.name} Question Repository
                    </h1>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 0,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: '#F8FAFC',
                        color: 'var(--primary-red)',
                        border: '1px solid #BFDBFE',
                      }}
                    >
                      {selectedSubject.code}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: '#64748B', marginTop: 2, display: 'block' }}>
                    {questions.length} total questions cataloged across past UPSC papers
                  </span>
                </div>
              </div>

              {/* Subject Intelligence Summary Pills */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: isMobile ? '100%' : 'auto',
                  flexWrap: 'wrap',
                }}
              >
                {/* Difficulty Distribution Pill */}
                <div
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '6px 10px',
                    backgroundColor: '#FAFAFA',
                    border: '1px solid #E2E8F0',
                    fontSize: 11.5,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <BarChart3 size={13} color="#64748B" />
                  <span>
                    <strong style={{ color: '#16A34A' }}>{difficultyCounts.easy}</strong> E ·{' '}
                    <strong style={{ color: '#D97706' }}>{difficultyCounts.medium}</strong> M ·{' '}
                    <strong style={{ color: '#DC2626' }}>{difficultyCounts.hard}</strong> H
                  </span>
                </div>

                {/* Subtopic Coverage Pill */}
                <div
                  style={{
                    flex: isMobile ? 1 : 'none',
                    padding: '6px 10px',
                    backgroundColor: '#FAFAFA',
                    border: '1px solid #E2E8F0',
                    fontSize: 11.5,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Layers size={13} color="#64748B" />
                  <span>
                    <strong>{subtopicCounts.length}</strong> Subtopics
                  </span>
                </div>
              </div>
            </div>

            {/* Exam Year Breakdown Ribbon */}
            {yearCounts.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#64748B',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <Calendar size={12} /> Paper Sets:
                </span>
                {yearCounts.map((yc) => (
                  <span
                    key={yc.year}
                    onClick={() => setSelectedYear(selectedYear === yc.year.toString() ? 'ALL' : yc.year.toString())}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: '2px 8px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      border: selectedYear === yc.year.toString() ? '1px solid var(--primary-red)' : '1px solid #E2E8F0',
                      backgroundColor: selectedYear === yc.year.toString() ? 'var(--primary-red)' : '#F8FAFC',
                      color: selectedYear === yc.year.toString() ? '#FFFFFF' : '#334155',
                      transition: 'all 150ms ease-out',
                    }}
                  >
                    {yc.year} ({yc.count})
                  </span>
                ))}
                {selectedYear !== 'ALL' && (
                  <button
                    onClick={() => setSelectedYear('ALL')}
                    style={{
                      fontSize: 11,
                      color: '#EF4444',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      flexShrink: 0,
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Responsive View Switcher for Tablet & Mobile screens */}
          {isTabletOrBelow && (
            <div
              style={{
                display: 'flex',
                gap: 4,
                marginBottom: 14,
                backgroundColor: '#E2E8F0',
                padding: 4,
                borderRadius: 0,
              }}
            >
              <button
                onClick={() => setMobileExploreTab('list')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  fontSize: 12.5,
                  fontWeight: mobileExploreTab === 'list' ? 700 : 500,
                  backgroundColor: mobileExploreTab === 'list' ? '#FFFFFF' : 'transparent',
                  color: mobileExploreTab === 'list' ? '#172033' : '#64748B',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: mobileExploreTab === 'list' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  transition: 'all 150ms ease-out',
                }}
              >
                <Layers size={14} color={mobileExploreTab === 'list' ? 'var(--primary-red)' : '#64748B'} />
                <span>Questions List ({filteredQuestions.length})</span>
              </button>
              <button
                onClick={() => setMobileExploreTab('preview')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  fontSize: 12.5,
                  fontWeight: mobileExploreTab === 'preview' ? 700 : 500,
                  backgroundColor: mobileExploreTab === 'preview' ? '#FFFFFF' : 'transparent',
                  color: mobileExploreTab === 'preview' ? '#172033' : '#64748B',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: mobileExploreTab === 'preview' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  transition: 'all 150ms ease-out',
                }}
              >
                <BookOpen size={14} color={mobileExploreTab === 'preview' ? 'var(--primary-red)' : '#64748B'} />
                <span>
                  Question Preview {selectedQuestion ? `(Q${selectedQuestion.question_number_in_paper})` : ''}
                </span>
              </button>
            </div>
          )}

          {/* Split-Pane Exploration Container */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isTabletOrBelow ? '1fr' : '340px 1fr',
              gap: 20,
              minHeight: 680,
            }}
          >
            {/* LEFT PANEL: SUBTOPICS FILTER & QUESTION BROWSER */}
            {(!isTabletOrBelow || mobileExploreTab === 'list') && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  padding: isMobile ? 12 : 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                }}
              >
                {/* Subtopic Filter Dropdown */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4, letterSpacing: '0.02em' }}>
                    FILTER BY SUBTOPIC ({subtopicCounts.length})
                  </label>
                  <select
                    value={selectedSubtopic}
                    onChange={(e) => {
                      setSelectedSubtopic(e.target.value);
                      setSelectedQuestionIndex(0);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 0,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      color: '#172033',
                      backgroundColor: '#FAFAFA',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="ALL">All Subtopics ({questions.length})</option>
                    {subtopicCounts.map((st) => (
                      <option key={st.name} value={st.name}>
                        {st.name} ({st.count})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Difficulty Filter Tabs */}
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4, letterSpacing: '0.02em' }}>
                    DIFFICULTY
                  </label>
                  <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 0 }}>
                    {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => {
                          setSelectedDifficulty(lvl);
                          setSelectedQuestionIndex(0);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 4px',
                          fontSize: 11,
                          fontWeight: selectedDifficulty === lvl ? 700 : 500,
                          border: 'none',
                          borderRadius: 0,
                          background: selectedDifficulty === lvl ? '#FFFFFF' : 'transparent',
                          color: selectedDifficulty === lvl ? '#172033' : '#64748B',
                          cursor: 'pointer',
                          boxShadow: selectedDifficulty === lvl ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                        }}
                      >
                        {lvl === 'ALL' ? 'All' : lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Search in Question Stem */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#64748B' }} />
                  <input
                    type="text"
                    placeholder="Search questions or keywords..."
                    value={questionSearchQuery}
                    onChange={(e) => {
                      setQuestionSearchQuery(e.target.value);
                      setSelectedQuestionIndex(0);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 8px 8px 30px',
                      borderRadius: 0,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      color: '#172033',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Header List Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#172033' }}>
                    {filteredQuestions.length} Questions Found
                  </span>
                  {(selectedSubtopic !== 'ALL' || selectedYear !== 'ALL' || selectedDifficulty !== 'ALL' || questionSearchQuery) && (
                    <button
                      onClick={() => {
                        setSelectedSubtopic('ALL');
                        setSelectedYear('ALL');
                        setSelectedDifficulty('ALL');
                        setQuestionSearchQuery('');
                      }}
                      style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Reset filters
                    </button>
                  )}
                </div>

                {/* Scrollable Questions Navigator */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 540 }}>
                  {loadingQuestions ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                      <Loader2 size={18} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                      Loading questions...
                    </div>
                  ) : filteredQuestions.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                      No questions match current filters.
                    </div>
                  ) : (
                    filteredQuestions.map((q, idx) => {
                      const isSelected = selectedQuestion?.id === q.id;

                      return (
                        <div
                          key={q.id}
                          onClick={() => {
                            setSelectedQuestionIndex(idx);
                            if (isTabletOrBelow) {
                              setMobileExploreTab('preview');
                              window.scrollTo({ top: 120, behavior: 'smooth' });
                            }
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 0,
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
                            border: isSelected ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                            borderLeft: isSelected ? '3px solid var(--primary-red)' : '1px solid #E2E8F0',
                            transition: 'all 150ms ease-out',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span
                              style={{
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                color: isSelected ? 'var(--primary-red)' : '#172033',
                                fontSize: 12.5,
                              }}
                            >
                              Q{q.question_number_in_paper < 10 ? `0${q.question_number_in_paper}` : q.question_number_in_paper}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: '#64748B',
                                backgroundColor: '#F1F5F9',
                                padding: '1px 6px',
                                borderRadius: 0,
                              }}
                            >
                              {q.source_year}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: isSelected ? '#172033' : '#475569',
                              fontWeight: isSelected ? 600 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginBottom: 4,
                            }}
                            title={q.question_text}
                          >
                            {q.question_text}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748B' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                              {q.subtopic_name}
                            </span>
                            <span>•</span>
                            <span style={{ fontWeight: 600, color: q.difficulty === 'HARD' ? '#DC2626' : q.difficulty === 'EASY' ? '#16A34A' : '#D97706' }}>
                              {q.difficulty}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* RIGHT PANEL: CLEAN READ-ONLY QUESTION INSPECTOR */}
            {(!isTabletOrBelow || mobileExploreTab === 'preview') && (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 0,
                  padding: isMobile ? '16px 14px' : '24px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                }}
              >
                {selectedQuestion ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Back to List button on mobile/tablet */}
                    {isTabletOrBelow && (
                      <button
                        onClick={() => {
                          setMobileExploreTab('list');
                          window.scrollTo({ top: 120, behavior: 'smooth' });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 12px',
                          marginBottom: 4,
                          backgroundColor: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          borderRadius: 0,
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#334155',
                          cursor: 'pointer',
                          alignSelf: 'flex-start',
                        }}
                      >
                        <ArrowLeft size={13} />
                        <span>Back to Questions List ({filteredQuestions.length})</span>
                      </button>
                    )}

                    {/* Top Pedagogical Toolbar & Action Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: 12,
                        paddingBottom: 14,
                        borderBottom: '1px solid #E2E8F0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#172033', fontSize: 14 }}>
                            Question #{selectedQuestion.question_number_in_paper}
                          </span>
                          <span>•</span>
                          <span>{selectedQuestion.exam_name}</span>
                          <span>•</span>
                          <span>{selectedQuestion.source_year}</span>
                          <span>•</span>
                          <span
                            style={{
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 0,
                              backgroundColor:
                                selectedQuestion.difficulty === 'HARD'
                                  ? '#FEE2E2'
                                  : selectedQuestion.difficulty === 'EASY'
                                  ? '#DCFCE7'
                                  : '#FEF3C7',
                              color:
                                selectedQuestion.difficulty === 'HARD'
                                  ? '#B91C1C'
                                  : selectedQuestion.difficulty === 'EASY'
                                  ? '#15803D'
                                  : '#B45309',
                            }}
                          >
                            {selectedQuestion.difficulty}
                          </span>
                          <span>•</span>
                          <span style={{ fontSize: 11.5, color: '#64748B' }}>+{selectedQuestion.marks} marks</span>
                        </div>
                      </div>

                      {/* Non-Edit Exploration Action Buttons */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: isMobile ? '100%' : 'auto',
                          justifyContent: isMobile ? 'space-between' : 'flex-end',
                        }}
                      >
                        {/* Copy Question ID */}
                        <button
                          onClick={() => handleCopyQuestionId(selectedQuestion.id)}
                          title="Copy Question ID"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 12px',
                            borderRadius: 0,
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            color: '#475569',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Copy size={13} />
                          <span>Copy ID</span>
                        </button>

                        {/* Open in Exam Reviewer */}
                        <button
                          onClick={() => handleOpenInReviewer(selectedQuestion)}
                          title="Audit or edit this question in the dedicated Exam Reviewer workspace"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 14px',
                            borderRadius: 0,
                            border: '1px solid #CBD5E1',
                            background: '#F8FAFC',
                            color: '#172033',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 150ms ease-out',
                          }}
                        >
                          <ExternalLink size={13} color="var(--primary-red)" />
                          <span>{isMobile ? 'Reviewer' : 'Inspect in Exam Reviewer'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Clean Publication Standard Format Display Card */}
                    <AdminQuestionPublicationCard
                      question={{
                        id: selectedQuestion.id,
                        question_number_in_paper: selectedQuestion.question_number_in_paper,
                        question_text: selectedQuestion.question_text,
                        passage_text: selectedQuestion.passage_text,
                        difficulty: selectedQuestion.difficulty,
                        marks: selectedQuestion.marks,
                        subject_name: selectedQuestion.subject_name,
                        topic_name: selectedQuestion.topic_name,
                        subtopic_name: selectedQuestion.subtopic_name,
                        options: selectedQuestion.options,
                        explanation: selectedQuestion.explanation,
                      }}
                      questionNumber={selectedQuestion.question_number_in_paper}
                      style={{ border: 'none', padding: 0, boxShadow: 'none' }}
                    />

                    {/* Bottom Navigation Toolbar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 16,
                        borderTop: '1px solid #E2E8F0',
                        gap: 8,
                      }}
                    >
                      <button
                        disabled={selectedQuestionIndex === 0}
                        onClick={() => {
                          setSelectedQuestionIndex((prev) => Math.max(0, prev - 1));
                          if (isTabletOrBelow) window.scrollTo({ top: 120, behavior: 'smooth' });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: isMobile ? '7px 10px' : '7px 14px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          borderRadius: 0,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: selectedQuestionIndex === 0 ? '#CBD5E1' : '#334155',
                          cursor: selectedQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ChevronLeft size={15} />
                        <span>{isMobile ? 'Prev' : 'Previous Question'}</span>
                      </button>

                      <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, textAlign: 'center' }}>
                        {isMobile
                          ? `Q ${selectedQuestionIndex + 1} / ${filteredQuestions.length}`
                          : `Question ${selectedQuestionIndex + 1} of ${filteredQuestions.length}`}
                      </span>

                      <button
                        disabled={selectedQuestionIndex >= filteredQuestions.length - 1}
                        onClick={() => {
                          setSelectedQuestionIndex((prev) => Math.min(filteredQuestions.length - 1, prev + 1));
                          if (isTabletOrBelow) window.scrollTo({ top: 120, behavior: 'smooth' });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: isMobile ? '7px 10px' : '7px 14px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          borderRadius: 0,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: selectedQuestionIndex >= filteredQuestions.length - 1 ? '#CBD5E1' : '#334155',
                          cursor: selectedQuestionIndex >= filteredQuestions.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span>{isMobile ? 'Next' : 'Next Question'}</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748B', padding: 60 }}>
                    <BookOpen size={36} color="#CBD5E1" style={{ margin: '0 auto 12px auto' }} />
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
                      Select a question from the navigation panel to view its full publication preview.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
