import React, { useState, useEffect } from 'react';
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
  Check,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  X,
  Save,
  AlertTriangle,
  HelpCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  fetchCatalogQuestions,
  updateAdminQuestionDetail,
  updateAdminQuestionStatus,
} from '../../services/adminService';

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
  icon: any;
  description: string;
  questionsCount: string;
  pendingCount: number;
  subtopicsCount: number;
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

export function QuestionBankManager() {
  // Navigation State: null = Directory View, SubjectItem = Selected Subject
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);

  // Subject Directory Search
  const [subjectSearchQuery, setSubjectSearchQuery] = useState<string>('');

  // Questions State for selected subject
  const [questions, setQuestions] = useState<QuestionCatalogItem[]>([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Question Filters
  const [questionSearchQuery, setQuestionSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');

  // Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState<QuestionCatalogItem | null>(null);
  const [editFormText, setEditFormText] = useState<string>('');
  const [editFormOptions, setEditFormOptions] = useState<{ label: string; text: string; is_correct: boolean }[]>([]);
  const [editFormExplanation, setEditFormExplanation] = useState<string>('');
  const [editFormDifficulty, setEditFormDifficulty] = useState<string>('MEDIUM');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Subject Directory Definition
  const subjectList: SubjectItem[] = [
    {
      id: 'polity',
      name: 'Polity',
      code: 'POLITY',
      icon: Scale,
      description: 'Indian Constitution, Governance, Rights Issues, Executive, Judiciary & Federal Structure.',
      questionsCount: '1,240',
      pendingCount: 84,
      subtopicsCount: 32,
    },
    {
      id: 'economy',
      name: 'Economy',
      code: 'ECONOMY',
      icon: TrendingUp,
      description: 'Indian Economy, Monetary Policy, Banking, Inflation, Fiscal System & Agriculture.',
      questionsCount: '980',
      pendingCount: 42,
      subtopicsCount: 28,
    },
    {
      id: 'history',
      name: 'History',
      code: 'HISTORY',
      icon: Landmark,
      description: 'Ancient, Medieval, Modern Indian Freedom Struggle, Art & Culture.',
      questionsCount: '1,120',
      pendingCount: 67,
      subtopicsCount: 36,
    },
    {
      id: 'geography',
      name: 'Geography',
      code: 'GEOGRAPHY',
      icon: Globe,
      description: 'Physical Geography, Climatology, Indian & World Physical & Economic Geography.',
      questionsCount: '860',
      pendingCount: 31,
      subtopicsCount: 24,
    },
    {
      id: 'science',
      name: 'Science & Technology',
      code: 'SCIENCE',
      icon: Cpu,
      description: 'Space Tech, Biotechnology, Defense, IT, Nanotech & Everyday General Science.',
      questionsCount: '740',
      pendingCount: 28,
      subtopicsCount: 22,
    },
    {
      id: 'environment',
      name: 'Environment',
      code: 'ENVIRONMENT',
      icon: TreePine,
      description: 'Ecology, Biodiversity Conservation, Climate Change & Environmental Laws.',
      questionsCount: '520',
      pendingCount: 19,
      subtopicsCount: 18,
    },
    {
      id: 'current',
      name: 'Current Affairs',
      code: 'CURRENT_AFFAIRS',
      icon: Newspaper,
      description: 'National & International Events, Reports, Indices & Government Schemes.',
      questionsCount: '430',
      pendingCount: 12,
      subtopicsCount: 14,
    },
  ];

  // Dynamic Aggregate Metadata Calculations
  const totalQuestionsSum = subjectList.reduce(
    (acc, s) => acc + parseInt(s.questionsCount.replace(/,/g, ''), 10),
    0
  );
  const totalSubtopicsSum = subjectList.reduce((acc, s) => acc + s.subtopicsCount, 0);

  useEffect(() => {
    if (selectedSubject) {
      loadQuestionsForSubject(selectedSubject.name);
    }
  }, [selectedSubject]);

  const loadQuestionsForSubject = async (subjectName: string) => {
    setLoadingQuestions(true);
    setErrorMsg('');
    try {
      const data = await fetchCatalogQuestions(1, 100, subjectName);

      const mapped = (data.items || []).map((q: any, idx: number) => ({
        id: q.question_id || q.id,
        question_number_in_paper: q.question_number_in_paper || idx + 1,
        question_type: q.question_type || 'SINGLE_CHOICE',
        difficulty: q.difficulty || 'MEDIUM',
        marks: q.marks || 2.0,
        status: q.status || 'PENDING_HUMAN_REVIEW',
        question_text: q.question_text || 'No question text stem available',
        passage_text: q.passage_text,
        exam_name: q.exam_name || 'UPSC CSE Prelims',
        exam_code: q.exam_code || 'UPSC_CSE',
        source_year: q.source_year || 2023,
        subject_name: q.subject_name || q.hierarchy?.[0]?.subject_name || subjectName,
        topic_name: q.topic_name || q.hierarchy?.[0]?.topic_name || 'Constitutional Provisions',
        subtopic_name: q.subtopic_name || q.hierarchy?.[0]?.subtopic_name || 'Parliament & Executive',
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

  const handleApproveQuestion = async (questionId: string) => {
    setActionLoadingId(questionId);
    setErrorMsg('');
    try {
      await updateAdminQuestionStatus(questionId, 'PUBLISHED');
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, status: 'PUBLISHED' } : q))
      );
      setSuccessMsg('Question approved & published successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve question.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectQuestion = async (questionId: string) => {
    setActionLoadingId(questionId);
    setErrorMsg('');
    try {
      await updateAdminQuestionStatus(questionId, 'REJECTED');
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, status: 'REJECTED' } : q))
      );
      setSuccessMsg('Question marked as Rejected.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject question.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openEditModal = (q: QuestionCatalogItem) => {
    setEditingQuestion(q);
    setEditFormText(q.question_text || '');
    setEditFormExplanation(q.explanation?.detailed_solution || '');
    setEditFormDifficulty(q.difficulty || 'MEDIUM');

    const formattedOpts = ['A', 'B', 'C', 'D'].map((label, idx) => {
      const existing = q.options.find((o) => o.option_label.toUpperCase() === label) || q.options[idx];
      return {
        label,
        text: existing ? existing.option_text : '',
        is_correct: existing ? existing.is_correct : idx === 0,
      };
    });
    setEditFormOptions(formattedOpts);
  };

  const handleSaveQuestionEdit = async () => {
    if (!editingQuestion) return;
    setSavingEdit(true);
    setErrorMsg('');
    try {
      const payload = {
        question_text: editFormText,
        difficulty: editFormDifficulty,
        status: 'PUBLISHED',
        options: editFormOptions.map((o) => ({
          option_label: o.label,
          option_text: o.text,
          is_correct: o.is_correct,
        })),
        detailed_solution: editFormExplanation,
      };

      await updateAdminQuestionDetail(editingQuestion.id, payload);

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id === editingQuestion.id) {
            return {
              ...q,
              question_text: editFormText,
              difficulty: editFormDifficulty,
              status: 'PUBLISHED',
              options: editFormOptions.map((o, idx) => ({
                option_label: o.label,
                option_text: o.text,
                is_correct: o.is_correct,
                display_order: idx + 1,
              })),
              explanation: {
                detailed_solution: editFormExplanation,
              },
            };
          }
          return q;
        })
      );

      setSuccessMsg('Question and options updated & published successfully!');
      setEditingQuestion(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not update question details.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Filtered Subject List for Directory
  const filteredSubjects = subjectList.filter((s) => {
    if (!subjectSearchQuery) return true;
    const term = subjectSearchQuery.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.description.toLowerCase().includes(term);
  });

  // Filtered Questions for Split Pane
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      !questionSearchQuery ||
      q.question_text.toLowerCase().includes(questionSearchQuery.toLowerCase()) ||
      q.subtopic_name?.toLowerCase().includes(questionSearchQuery.toLowerCase()) ||
      q.question_number_in_paper.toString() === questionSearchQuery;

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && q.status.toUpperCase().includes('PENDING')) ||
      (statusFilter === 'APPROVED' && (q.status.toUpperCase().includes('PUBLISHED') || q.status.toUpperCase().includes('READY')));

    return matchesSearch && matchesStatus;
  });

  const selectedQuestion = filteredQuestions[selectedQuestionIndex] || filteredQuestions[0] || null;

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif', paddingBottom: 60 }}>
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
            boxShadow: '0 4px 12px rgba(180, 35, 24, 0.1)',
          }}
        >
          <AlertTriangle size={18} color="#B42318" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: '#DCFCE7',
            border: '1px solid #86EFAC',
            borderRadius: 0,
            marginBottom: 20,
            color: '#15803D',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(21, 128, 61, 0.1)',
          }}
        >
          <CheckCircle2 size={18} color="#15803D" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* MODE 1: SUBJECT DIRECTORY / CATALOG MANAGEMENT VIEW */}
      {!selectedSubject ? (
        <div>
          {/* Editorial Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
                Question Bank
              </h1>
              <p style={{ fontSize: 14, color: '#64748B', marginTop: 4, margin: '4px 0 0 0' }}>
                Browse and review questions organized by subject and mapped subtopics.
              </p>
              {/* Contextual Metadata Badge Line */}
              <div style={{ marginTop: 8 }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--primary-red)',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #BFDBFE',
                    padding: '3px 10px',
                    borderRadius: 0,
                  }}
                >
                  {subjectList.length} Subjects · {totalQuestionsSum.toLocaleString()} Questions · {totalSubtopicsSum} Subtopics
                </span>
              </div>
            </div>

            {/* Compact Search Field */}
            <div style={{ position: 'relative', width: 280 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748B' }} />
              <input
                type="text"
                placeholder="Search subjects or questions..."
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
              overflow: 'hidden',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 13.5,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>SUBJECT</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>DESCRIPTION</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>QUESTIONS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>PENDING REVIEW</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em' }}>SUBTOPICS</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, color: '#64748B', fontSize: 12, letterSpacing: '0.04em', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((sub, i) => {
                  const IconComponent = sub.icon;
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => setSelectedSubject(sub)}
                      style={{
                        borderBottom: i === filteredSubjects.length - 1 ? 'none' : '1px solid #E2E8F0',
                        cursor: 'pointer',
                        transition: 'all 150ms ease-out',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                        e.currentTarget.style.borderLeft = '3px solid var(--primary-red)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                        e.currentTarget.style.borderLeft = '3px solid transparent';
                      }}
                    >
                      {/* Subject Column Anchor */}
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: '#172033', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 0,
                              background: '#F8FAFC',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <IconComponent size={17} color="var(--primary-red)" />
                          </div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#172033', lineHeight: 1.2 }}>
                              {sub.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: 400 }}>
                              {sub.subtopicsCount} subtopics
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Description */}
                      <td style={{ padding: '16px', color: '#64748B', fontSize: 13.5, maxWidth: 380, lineHeight: 1.45 }}>
                        {sub.description}
                      </td>

                      {/* Question Count */}
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#172033', lineHeight: 1 }}>
                          {sub.questionsCount}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>questions</div>
                      </td>

                      {/* Pending Review Semantic Amber Badge */}
                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#B45309',
                            backgroundColor: '#FEF3C7',
                            border: '1px solid #FDE68A',
                            padding: '3px 9px',
                            borderRadius: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: '#F2B623' }} />
                          {sub.pendingCount} Pending Review
                        </span>
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
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MODE 2: SPLIT-PANE QUESTION REVIEW WORKSPACE FOR SELECTED SUBJECT */
        <div>
          {/* Header & Back Navigation */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              border: '1px solid #E2E8F0',
              padding: '20px 24px',
              marginBottom: 20,
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button
                  onClick={() => setSelectedSubject(null)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Question Bank</span>
                </button>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.015em' }}>
                      {selectedSubject.name} Questions
                    </h1>
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: 0,
                        fontSize: 11.5,
                        fontWeight: 600,
                        backgroundColor: '#F8FAFC',
                        color: 'var(--primary-red)',
                        border: '1px solid #BFDBFE',
                      }}
                    >
                      {selectedSubject.subtopicsCount} Subtopics
                    </span>
                  </div>
                  <span style={{ fontSize: 12.5, color: '#64748B', marginTop: 2, display: 'block' }}>
                    {questions.length} questions cataloged in database
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Split-Pane Review Container */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: 20,
              minHeight: 640,
            }}
          >
            {/* LEFT PANEL: QUESTION NAVIGATION LIST */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 0,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              }}
            >
              {/* List Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>Questions</span>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{filteredQuestions.length} total</span>
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 0 }}>
                {(['ALL', 'PENDING', 'APPROVED'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    style={{
                      flex: 1,
                      padding: '5px 6px',
                      fontSize: 11.5,
                      fontWeight: statusFilter === tab ? 700 : 500,
                      border: 'none',
                      borderRadius: 0,
                      background: statusFilter === tab ? '#FFFFFF' : 'transparent',
                      color: statusFilter === tab ? '#172033' : '#64748B',
                      cursor: 'pointer',
                      boxShadow: statusFilter === tab ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                    }}
                  >
                    {tab === 'ALL' ? 'All' : tab === 'PENDING' ? 'Pending' : 'Approved'}
                  </button>
                ))}
              </div>

              {/* Quick Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#64748B' }} />
                <input
                  type="text"
                  placeholder="Search Q# or text..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 8px 7px 30px',
                    borderRadius: 0,
                    border: '1px solid #CBD5E1',
                    fontSize: 12.5,
                    color: '#172033',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Question Rows */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 520 }}>
                {loadingQuestions ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>Loading questions...</div>
                ) : filteredQuestions.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>No questions match filter</div>
                ) : (
                  filteredQuestions.map((q, idx) => {
                    const isSelected = selectedQuestion?.id === q.id;
                    const isApproved = q.status.toUpperCase().includes('PUBLISHED') || q.status.toUpperCase().includes('READY');

                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuestionIndex(idx)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 0,
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
                          border: isSelected ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                          borderLeft: isSelected ? '3px solid var(--primary-red)' : '1px solid #E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12.5,
                          color: isSelected ? '#172033' : '#475569',
                          fontWeight: isSelected ? 700 : 400,
                          transition: 'all 150ms ease-out',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: isSelected ? 'var(--primary-red)' : '#172033' }}>
                            Q{q.question_number_in_paper < 10 ? `0${q.question_number_in_paper}` : q.question_number_in_paper}
                          </span>
                          <span style={{ fontSize: 12, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                            {q.subtopic_name}
                          </span>
                        </div>

                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 0,
                            backgroundColor: isApproved ? '#16A34A' : '#F2B623',
                          }}
                          title={isApproved ? 'Approved' : 'Pending Review'}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT PANEL: SELECTED QUESTION DETAIL WORKSPACE */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 0,
                padding: 26,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              }}
            >
              {selectedQuestion ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Top Action Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12.5, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, color: '#172033' }}>Q{selectedQuestion.question_number_in_paper}</span>
                        <span>•</span>
                        <span>{selectedQuestion.subject_name}</span>
                        <span>•</span>
                        <span>{selectedQuestion.subtopic_name}</span>
                        <span>•</span>
                        <span style={{ fontWeight: 600, color: 'var(--primary-red)' }}>{selectedQuestion.difficulty}</span>
                      </div>
                    </div>

                    {/* Review Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => openEditModal(selectedQuestion)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '7px 14px',
                          borderRadius: 0,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#172033',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={14} color="var(--primary-red)" />
                        <span>Edit</span>
                      </button>

                      <button
                        disabled={actionLoadingId === selectedQuestion.id}
                        onClick={() => handleApproveQuestion(selectedQuestion.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '7px 16px',
                          borderRadius: 0,
                          border: 'none',
                          background: selectedQuestion.status === 'PUBLISHED' ? '#DCFCE7' : '#16A34A',
                          color: selectedQuestion.status === 'PUBLISHED' ? '#15803D' : '#FFFFFF',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: actionLoadingId === selectedQuestion.id ? 'not-allowed' : 'pointer',
                          boxShadow: selectedQuestion.status === 'PUBLISHED' ? 'none' : '0 2px 6px rgba(22, 163, 74, 0.25)',
                        }}
                      >
                        <Check size={14} />
                        <span>{selectedQuestion.status === 'PUBLISHED' ? 'Approved' : 'Approve'}</span>
                      </button>

                      <button
                        disabled={actionLoadingId === selectedQuestion.id}
                        onClick={() => handleRejectQuestion(selectedQuestion.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '7px 12px',
                          borderRadius: 0,
                          border: '1px solid #FECDCA',
                          background: '#FEF2F2',
                          color: '#B42318',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: actionLoadingId === selectedQuestion.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ThumbsDown size={14} />
                        <span>Flag</span>
                      </button>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

                  {/* Publication Standard Format Card */}
                  <AdminQuestionPublicationCard
                    question={selectedQuestion}
                    questionNumber={selectedQuestion.question_number_in_paper}
                    style={{ border: 'none', padding: 0, boxShadow: 'none' }}
                  />

                  {/* Navigation Buttons Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #E2E8F0' }}>
                    <button
                      disabled={selectedQuestionIndex === 0}
                      onClick={() => setSelectedQuestionIndex((prev) => Math.max(0, prev - 1))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '7px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 0,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: selectedQuestionIndex === 0 ? '#CBD5E1' : '#334155',
                        cursor: selectedQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft size={15} /> Previous
                    </button>

                    <span style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600 }}>
                      Question {selectedQuestionIndex + 1} of {filteredQuestions.length}
                    </span>

                    <button
                      disabled={selectedQuestionIndex >= filteredQuestions.length - 1}
                      onClick={() => setSelectedQuestionIndex((prev) => Math.min(filteredQuestions.length - 1, prev + 1))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '7px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 0,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: selectedQuestionIndex >= filteredQuestions.length - 1 ? '#CBD5E1' : '#334155',
                        cursor: selectedQuestionIndex >= filteredQuestions.length - 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Next <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748B', padding: 40 }}>
                  Select a question from the navigation panel to view details.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DRAWER */}
      {editingQuestion && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              backgroundColor: '#FFFFFF',
              borderRadius: 0,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', backgroundColor: '#FAFAFA', borderBottom: '1px solid #E2E8F0', color: '#172033', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                Edit Question Q{editingQuestion.question_number_in_paper} & Answer Choices
              </div>
              <button
                onClick={() => setEditingQuestion(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#172033' }}>Question Stem Text</label>
                <textarea
                  rows={3}
                  value={editFormText}
                  onChange={(e) => setEditFormText(e.target.value)}
                  style={{ padding: 10, borderRadius: 0, border: '1px solid #CBD5E1', fontSize: 13.5, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#172033' }}>Options & Correct Answer</label>
                {editFormOptions.map((opt) => (
                  <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 0, border: `1px solid ${opt.is_correct ? '#86EFAC' : '#CBD5E1'}`, backgroundColor: opt.is_correct ? '#F0FDF4' : '#FFFFFF' }}>
                    <input
                      type="radio"
                      name="correctRadio"
                      checked={opt.is_correct}
                      onChange={() => setEditFormOptions((prev) => prev.map((o) => ({ ...o, is_correct: o.label === opt.label })))}
                    />
                    <span style={{ fontWeight: 700, width: 16, color: '#172033' }}>{opt.label}.</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => setEditFormOptions((prev) => prev.map((o) => (o.label === opt.label ? { ...o, text: e.target.value } : o)))}
                      style={{ flex: 1, padding: 7, borderRadius: 0, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#172033' }}>Solution Explanation</label>
                <textarea
                  rows={3}
                  value={editFormExplanation}
                  onChange={(e) => setEditFormExplanation(e.target.value)}
                  style={{ padding: 10, borderRadius: 0, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FAFAFA', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setEditingQuestion(null)}
                style={{ padding: '8px 16px', borderRadius: 0, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={savingEdit}
                onClick={handleSaveQuestionEdit}
                style={{ padding: '8px 18px', borderRadius: 0, border: 'none', background: '#16A34A', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)' }}
              >
                {savingEdit ? 'Saving...' : 'Save & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
