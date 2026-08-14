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
} from 'lucide-react';
import {
  fetchCatalogQuestions,
  updateAdminQuestionDetail,
  updateAdminQuestionStatus,
} from '../../services/adminService';

interface QuestionOptionItem {
  option_id?: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  display_order?: number;
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

  // Subject Directory Definition (Monochrome institutional aesthetic - NO RAINBOW COLORS)
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
        })),
        explanation: {
          core_concept: q.explanation?.core_concept,
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
    setEditFormExplanation(q.explanation?.detailed_solution || q.explanation?.core_concept || '');
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
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Global Toast / Alerts */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECDCA',
            borderRadius: 6,
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

      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            background: '#DCFCE7',
            border: '1px solid #BBF7D0',
            borderRadius: 6,
            marginBottom: 20,
            color: '#15803D',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={18} color="#15803D" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* MODE 1: SUBJECT DIRECTORY / MANAGEMENT VIEW */}
      {!selectedSubject ? (
        <div>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
                Question Bank
              </h1>
              <p style={{ fontSize: 14, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
                Browse and review questions organized by subject and mapped subtopics.
              </p>
            </div>

            {/* Subtle Search Input */}
            <div style={{ position: 'relative', width: 300 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#667085' }} />
              <input
                type="text"
                placeholder="Search subjects or questions..."
                value={subjectSearchQuery}
                onChange={(e) => setSubjectSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 6,
                  border: '1px solid #E4E7EC',
                  backgroundColor: '#FFFFFF',
                  fontSize: 13.5,
                  color: '#172033',
                  outline: 'none',
                  height: 40,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Subject Directory Table (Clean institutional presentation) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E4E7EC',
              borderRadius: 6,
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
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
                <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>SUBJECT</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>DESCRIPTION</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>QUESTIONS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>PENDING REVIEW</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>SUBTOPICS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>ACTION</th>
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
                        borderBottom: i === filteredSubjects.length - 1 ? 'none' : '1px solid #E4E7EC',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '16px', fontWeight: 600, color: '#172033', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 4, background: '#F7F7F5', border: '1px solid #E4E7EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconComponent size={16} color="#3B6EA8" />
                          </div>
                          <span>{sub.name}</span>
                        </div>
                      </td>

                      <td style={{ padding: '16px', color: '#667085', fontSize: 13, maxWidth: 360 }}>
                        {sub.description}
                      </td>

                      <td style={{ padding: '16px', color: '#172033', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {sub.questionsCount}
                      </td>

                      <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#B45309', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '2px 8px', borderRadius: 4 }}>
                          {sub.pendingCount} Pending
                        </span>
                      </td>

                      <td style={{ padding: '16px', color: '#667085', whiteSpace: 'nowrap' }}>
                        {sub.subtopicsCount} Subtopics
                      </td>

                      <td style={{ padding: '16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubject(sub);
                          }}
                          style={{
                            padding: '5px 12px',
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: '#172033',
                            background: '#FFFFFF',
                            border: '1px solid #E4E7EC',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          Explore →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MODE 2: SPLIT-PANE QUESTION REVIEW WORKSPACE */
        <div>
          {/* Breadcrumb Header sitting directly on main background */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#667085', marginBottom: 4 }}>
              <span onClick={() => setSelectedSubject(null)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                Question Bank
              </span>
              <span>/</span>
              <span style={{ color: '#172033', fontWeight: 600 }}>{selectedSubject.name}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#172033', margin: 0 }}>
                  {selectedSubject.name} Questions
                </h1>
                <span style={{ fontSize: 13, color: '#667085', marginTop: 2, display: 'block' }}>
                  {questions.length} questions cataloged in database
                </span>
              </div>

              <button
                onClick={() => setSelectedSubject(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 4,
                  background: '#FFFFFF',
                  border: '1px solid #E4E7EC',
                  color: '#172033',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to Subject Directory</span>
              </button>
            </div>
          </div>

          {/* Split-Pane Review Container */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '300px 1fr',
              gap: 20,
              minHeight: 640,
            }}
          >
            {/* LEFT PANEL: QUESTION NAVIGATION LIST */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E4E7EC',
                borderRadius: 6,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: '0 1px 2px rgba(16,24,40,0.02)',
              }}
            >
              {/* List Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>Questions</span>
                <span style={{ fontSize: 12, color: '#667085' }}>{filteredQuestions.length} total</span>
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: 4, background: '#F7F7F5', padding: 3, borderRadius: 4, border: '1px solid #E4E7EC' }}>
                {(['ALL', 'PENDING', 'APPROVED'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      fontSize: 11.5,
                      fontWeight: statusFilter === tab ? 600 : 500,
                      border: 'none',
                      borderRadius: 3,
                      background: statusFilter === tab ? '#FFFFFF' : 'transparent',
                      color: statusFilter === tab ? '#172033' : '#667085',
                      cursor: 'pointer',
                      boxShadow: statusFilter === tab ? '0 1px 2px rgba(16,24,40,0.05)' : 'none',
                    }}
                  >
                    {tab === 'ALL' ? 'All' : tab === 'PENDING' ? 'Pending' : 'Approved'}
                  </button>
                ))}
              </div>

              {/* Quick Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#667085' }} />
                <input
                  type="text"
                  placeholder="Search Q# or text..."
                  value={questionSearchQuery}
                  onChange={(e) => setQuestionSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px 6px 28px',
                    borderRadius: 4,
                    border: '1px solid #E4E7EC',
                    fontSize: 12,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* High Density Question Rows */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 520 }}>
                {loadingQuestions ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#667085', fontSize: 12 }}>Loading questions...</div>
                ) : filteredQuestions.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#667085', fontSize: 12 }}>No questions match filter</div>
                ) : (
                  filteredQuestions.map((q, idx) => {
                    const isSelected = selectedQuestion?.id === q.id;
                    const isApproved = q.status.toUpperCase().includes('PUBLISHED') || q.status.toUpperCase().includes('READY');

                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuestionIndex(idx)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(59, 110, 168, 0.1)' : 'transparent',
                          borderLeft: isSelected ? '3px solid #3B6EA8' : '3px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12.5,
                          color: isSelected ? '#172033' : '#344054',
                          fontWeight: isSelected ? 600 : 400,
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#F7F7F5';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>Q{q.question_number_in_paper < 10 ? `0${q.question_number_in_paper}` : q.question_number_in_paper}</span>
                          <span style={{ fontSize: 11.5, color: '#667085', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                            {q.subtopic_name}
                          </span>
                        </div>

                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: isApproved ? '#15803D' : '#B45309',
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
                border: '1px solid #E4E7EC',
                borderRadius: 6,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 1px 2px rgba(16,24,40,0.02)',
              }}
            >
              {selectedQuestion ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Top Bar: Question Number & Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#667085', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Q{selectedQuestion.question_number_in_paper}</span>
                        <span>•</span>
                        <span>{selectedQuestion.subject_name}</span>
                        <span>•</span>
                        <span>{selectedQuestion.subtopic_name}</span>
                        <span>•</span>
                        <span style={{ fontWeight: 600, color: '#172033' }}>{selectedQuestion.difficulty}</span>
                      </div>
                    </div>

                    {/* Review Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => openEditModal(selectedQuestion)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 12px',
                          borderRadius: 4,
                          border: '1px solid #E4E7EC',
                          background: '#FFFFFF',
                          color: '#172033',
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        disabled={actionLoadingId === selectedQuestion.id}
                        onClick={() => handleApproveQuestion(selectedQuestion.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 14px',
                          borderRadius: 4,
                          border: 'none',
                          background: selectedQuestion.status === 'PUBLISHED' ? '#DCFCE7' : '#12233F',
                          color: selectedQuestion.status === 'PUBLISHED' ? '#15803D' : '#FFFFFF',
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: actionLoadingId === selectedQuestion.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <Check size={13} />
                        <span>{selectedQuestion.status === 'PUBLISHED' ? 'Approved' : 'Approve'}</span>
                      </button>

                      <button
                        disabled={actionLoadingId === selectedQuestion.id}
                        onClick={() => handleRejectQuestion(selectedQuestion.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 10px',
                          borderRadius: 4,
                          border: '1px solid #FECDCA',
                          background: '#FEF2F2',
                          color: '#B42318',
                          fontSize: 12.5,
                          fontWeight: 500,
                          cursor: actionLoadingId === selectedQuestion.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ThumbsDown size={13} />
                        <span>Flag</span>
                      </button>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #E4E7EC', margin: 0 }} />

                  {/* Question Stem Text */}
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: '#172033', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      Q{selectedQuestion.question_number_in_paper} [{selectedQuestion.source_year}]: {selectedQuestion.question_text}
                    </h3>
                  </div>

                  {/* Answer Options Vertical List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedQuestion.options.map((opt) => (
                      <div
                        key={opt.option_label}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 4,
                          backgroundColor: opt.is_correct ? '#F0FDF4' : '#FFFFFF',
                          border: `1px solid ${opt.is_correct ? '#BBF7D0' : '#E4E7EC'}`,
                          fontSize: 13.5,
                          color: '#172033',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 700, color: opt.is_correct ? '#15803D' : '#3B6EA8', width: 16 }}>
                            {opt.option_label}.
                          </span>
                          <span>{opt.option_text || <em>(Empty option text)</em>}</span>
                        </div>

                        {opt.is_correct && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#15803D', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: 3 }}>
                            ✓ Correct Answer
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Solution Explanation Box */}
                  {selectedQuestion.explanation?.detailed_solution && (
                    <div style={{ padding: 14, borderRadius: 4, backgroundColor: '#F7F7F5', border: '1px solid #E4E7EC' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#667085', textTransform: 'uppercase', marginBottom: 4 }}>
                        Solution Explanation & Core Concept
                      </div>
                      <p style={{ fontSize: 13, color: '#344054', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                        {selectedQuestion.explanation.detailed_solution}
                      </p>
                    </div>
                  )}

                  {/* Navigation Buttons Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid #E4E7EC' }}>
                    <button
                      disabled={selectedQuestionIndex === 0}
                      onClick={() => setSelectedQuestionIndex((prev) => Math.max(0, prev - 1))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '6px 12px',
                        fontSize: 12.5,
                        fontWeight: 500,
                        borderRadius: 4,
                        border: '1px solid #E4E7EC',
                        background: '#FFFFFF',
                        color: '#172033',
                        cursor: selectedQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: selectedQuestionIndex === 0 ? 0.5 : 1,
                      }}
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>

                    <span style={{ fontSize: 12, color: '#667085' }}>
                      Question {selectedQuestionIndex + 1} of {filteredQuestions.length}
                    </span>

                    <button
                      disabled={selectedQuestionIndex >= filteredQuestions.length - 1}
                      onClick={() => setSelectedQuestionIndex((prev) => Math.min(filteredQuestions.length - 1, prev + 1))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '6px 12px',
                        fontSize: 12.5,
                        fontWeight: 500,
                        borderRadius: 4,
                        border: '1px solid #E4E7EC',
                        background: '#FFFFFF',
                        color: '#172033',
                        cursor: selectedQuestionIndex >= filteredQuestions.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: selectedQuestionIndex >= filteredQuestions.length - 1 ? 0.5 : 1,
                      }}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#667085', padding: 40 }}>
                  Select a question from the navigation panel to view details.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DRAWER */}
      {editingQuestion && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(16, 33, 61, 0.5)', backdropFilter: 'blur(2px)', zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              backgroundColor: '#FFFFFF',
              borderRadius: 6,
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #E4E7EC',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', backgroundColor: '#10213D', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                Edit Question Q{editingQuestion.question_number_in_paper} & Answer Choices
              </div>
              <button
                onClick={() => setEditingQuestion(null)}
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#172033' }}>Question Stem Text</label>
                <textarea
                  rows={3}
                  value={editFormText}
                  onChange={(e) => setEditFormText(e.target.value)}
                  style={{ padding: 10, borderRadius: 4, border: '1px solid #E4E7EC', fontSize: 13.5, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#172033' }}>Options & Correct Answer</label>
                {editFormOptions.map((opt) => (
                  <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 4, border: `1px solid ${opt.is_correct ? '#BBF7D0' : '#E4E7EC'}`, backgroundColor: opt.is_correct ? '#F0FDF4' : '#FFFFFF' }}>
                    <input
                      type="radio"
                      name="correctRadio"
                      checked={opt.is_correct}
                      onChange={() => setEditFormOptions((prev) => prev.map((o) => ({ ...o, is_correct: o.label === opt.label })))}
                    />
                    <span style={{ fontWeight: 700, width: 16 }}>{opt.label}.</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => setEditFormOptions((prev) => prev.map((o) => (o.label === opt.label ? { ...o, text: e.target.value } : o)))}
                      style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #E4E7EC', fontSize: 13, outline: 'none' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#172033' }}>Solution Explanation</label>
                <textarea
                  rows={3}
                  value={editFormExplanation}
                  onChange={(e) => setEditFormExplanation(e.target.value)}
                  style={{ padding: 10, borderRadius: 4, border: '1px solid #E4E7EC', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #E4E7EC', backgroundColor: '#F7F7F5', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setEditingQuestion(null)}
                style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid #E4E7EC', background: '#FFFFFF', color: '#172033', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={savingEdit}
                onClick={handleSaveQuestionEdit}
                style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: '#12233F', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
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
