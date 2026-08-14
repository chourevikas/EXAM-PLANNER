import React, { useState, useEffect } from 'react';
import {
  Search,
  ArrowLeft,
  BookOpen,
  Loader2,
  Save,
  X,
  Check,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import {
  fetchExamPipelineStatuses,
  fetchQuestionsByExam,
  updateAdminQuestionDetail,
  updateAdminQuestionStatus,
  ExamPipelineStatusItem,
} from '../../../services/adminService';

interface QuestionOptionItem {
  option_id?: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  display_order?: number;
}

interface QuestionDetailItem {
  id: string;
  question_number_in_paper: number;
  question_type: string;
  difficulty: string;
  marks: number;
  status: string;
  question_text: string;
  passage_text?: string;
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
  options: QuestionOptionItem[];
  explanation?: {
    core_concept?: string;
    detailed_solution?: string;
  };
}

export function QuestionReviewView() {
  // Navigation State: null = Exam Directory Table, ExamPipelineStatusItem = Split-Pane Review Workspace
  const [selectedExam, setSelectedExam] = useState<ExamPipelineStatusItem | null>(null);

  // Data States
  const [examsList, setExamsList] = useState<ExamPipelineStatusItem[]>([]);
  const [questionsList, setQuestionsList] = useState<QuestionDetailItem[]>([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);

  // Loading & Feedback States
  const [loadingExams, setLoadingExams] = useState<boolean>(true);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Exam Directory Filter States
  const [examSearchQuery, setExamSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, PENDING, PUBLISHED
  const [stageFilter, setStageFilter] = useState<string>('ALL'); // ALL, prelims, mains
  const [yearFilter, setYearFilter] = useState<string>('ALL'); // ALL, 2025, 2024, 2023, 2022, 2021
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Workspace Question Search/Filter State
  const [questionSearchQuery, setQuestionSearchQuery] = useState<string>('');
  const [questionStatusFilter, setQuestionStatusFilter] = useState<string>('ALL');

  // Question Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState<QuestionDetailItem | null>(null);
  const [editFormText, setEditFormText] = useState<string>('');
  const [editFormOptions, setEditFormOptions] = useState<{ label: string; text: string; is_correct: boolean }[]>([]);
  const [editFormExplanation, setEditFormExplanation] = useState<string>('');
  const [editFormDifficulty, setEditFormDifficulty] = useState<string>('MEDIUM');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      loadQuestions(selectedExam, questionStatusFilter);
    }
  }, [selectedExam, questionStatusFilter]);

  const loadExams = async () => {
    setLoadingExams(true);
    setErrorMsg('');
    try {
      const data = await fetchExamPipelineStatuses();
      setExamsList(data);
    } catch (err: any) {
      console.error('Failed to load exams list:', err);
      setErrorMsg(err.message || 'Could not load exam papers from server.');
    } finally {
      setLoadingExams(false);
    }
  };

  const loadQuestions = async (exam: ExamPipelineStatusItem, status?: string) => {
    setLoadingQuestions(true);
    setErrorMsg('');
    try {
      let res = await fetchQuestionsByExam(exam.id, 1, 100, status);

      // Fallback if 0 items returned by exam.id
      if ((!res.items || res.items.length === 0) && (exam.paper_set_code || exam.source_year)) {
        let fallbackUrl = `/api/v1/questions?page=1&limit=100`;
        if (exam.paper_set_code) fallbackUrl += `&paper_set_code=${exam.paper_set_code}`;
        if (exam.source_year) fallbackUrl += `&exam_year=${exam.source_year}`;
        if (status && status !== 'ALL') fallbackUrl += `&status=${status}`;

        const token = localStorage.getItem('access_token');
        const fallbackRes = await fetch(fallbackUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData.items && fallbackData.items.length > 0) {
            res = fallbackData;
          }
        }
      }

      const items = (res.items || []).map((q: any, idx: number) => ({
        id: q.question_id || q.id,
        question_number_in_paper: q.question_number_in_paper || idx + 1,
        question_type: q.question_type || 'SINGLE_CHOICE',
        difficulty: q.difficulty || 'MEDIUM',
        marks: q.marks || 2.0,
        status: q.status || 'PENDING_HUMAN_REVIEW',
        question_text: q.question_text || 'No question text available',
        passage_text: q.passage_text,
        subject_name: q.subject_name || q.hierarchy?.[0]?.subject_name || q.hierarchy_links?.[0]?.subject_name || 'General Studies',
        topic_name: q.topic_name || q.hierarchy?.[0]?.topic_name || q.hierarchy_links?.[0]?.topic_name || 'Core Topic',
        subtopic_name: q.subtopic_name || q.hierarchy?.[0]?.subtopic_name || q.hierarchy_links?.[0]?.subtopic_name || 'Subtopic',
        options: (q.options || []).map((opt: any, optIdx: number) => ({
          option_id: opt.option_id || opt.id,
          option_label: opt.option_label || String.fromCharCode(65 + optIdx),
          option_text: opt.option_text || opt.text || '',
          is_correct: Boolean(opt.is_correct),
          display_order: opt.display_order || optIdx + 1,
        })),
        explanation: {
          core_concept: q.explanation?.core_concept,
          detailed_solution: q.explanation?.detailed_solution || (typeof q.explanation === 'string' ? q.explanation : ''),
        },
      }));

      setQuestionsList(items);
      setSelectedQuestionIndex(0);
    } catch (err: any) {
      console.error('Failed to load questions:', err);
      setErrorMsg(err.message || 'Could not load questions for this examination paper.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleApproveQuestion = async (questionId: string) => {
    setActionLoadingId(questionId);
    setErrorMsg('');
    try {
      await updateAdminQuestionStatus(questionId, 'PUBLISHED');
      setQuestionsList((prev) => prev.map((q) => (q.id === questionId ? { ...q, status: 'PUBLISHED' } : q)));
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
      setQuestionsList((prev) => prev.map((q) => (q.id === questionId ? { ...q, status: 'REJECTED' } : q)));
      setSuccessMsg('Question marked as Rejected.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject question.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openEditModal = (q: QuestionDetailItem) => {
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

      setQuestionsList((prev) =>
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

      setSuccessMsg('Question updated & published successfully!');
      setEditingQuestion(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not update question details.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Filter Directory Exams
  const filteredExams = examsList.filter((ex) => {
    const matchesSearch =
      !examSearchQuery ||
      ex.name?.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
      ex.code?.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
      ex.source_year?.toString().includes(examSearchQuery);

    const statusUpper = (ex.status || '').toUpperCase();
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && (statusUpper.includes('PENDING') || statusUpper.includes('REVIEW'))) ||
      (statusFilter === 'PUBLISHED' && (statusUpper.includes('PUBLISHED') || statusUpper.includes('READY')));

    const stageUpper = (ex.stage || '').toUpperCase();
    const matchesStage =
      stageFilter === 'ALL' || stageUpper.includes(stageFilter.toUpperCase());

    const matchesYear =
      yearFilter === 'ALL' || ex.source_year?.toString() === yearFilter;

    return matchesSearch && matchesStatus && matchesStage && matchesYear;
  });

  // Directory Pagination Logic
  const totalPapersCount = filteredExams.length;
  const pendingCount = examsList.filter((e) => (e.status || '').toUpperCase().includes('PENDING')).length;
  const publishedCount = examsList.filter((e) => (e.status || '').toUpperCase().includes('PUBLISHED')).length;

  const totalPages = Math.ceil(totalPapersCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedExams = filteredExams.slice(startIndex, startIndex + pageSize);

  // Filter Workspace Questions
  const filteredQuestions = questionsList.filter((q) => {
    if (!questionSearchQuery) return true;
    const term = questionSearchQuery.toLowerCase();
    return (
      q.question_text.toLowerCase().includes(term) ||
      q.subtopic_name?.toLowerCase().includes(term) ||
      q.question_number_in_paper.toString() === term
    );
  });

  const selectedQuestion = filteredQuestions[selectedQuestionIndex] || filteredQuestions[0] || null;

  const formatHumanStatus = (statusStr: string) => {
    const s = (statusStr || '').toUpperCase();
    if (s.includes('PUBLISHED') || s.includes('READY')) {
      return { label: 'Published', bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0' };
    }
    return { label: 'Pending review', bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' };
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Banner Alert Feedback */}
      {errorMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            background: '#FEF2F2',
            border: '1px solid #FECDCA',
            color: '#B42318',
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertTriangle size={16} color="#B42318" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            background: '#DCFCE7',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} color="#15803D" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* VIEW 1: EXAM PAPER MANAGEMENT TABLE DIRECTORY */}
      {!selectedExam ? (
        <div>
          {/* Header Row (Sitting directly on background) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#172033', margin: 0, letterSpacing: '-0.02em' }}>
                Question Review
              </h1>
              <p style={{ fontSize: 14, color: '#667085', marginTop: 4, margin: '4px 0 0 0' }}>
                Select an examination paper to review extracted questions, answers, topics, and solution metadata.
              </p>
            </div>

            {/* Compact Search Field */}
            <div style={{ position: 'relative', width: 280 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 13, color: '#667085' }} />
              <input
                type="text"
                placeholder="Search exam code, title, or year..."
                value={examSearchQuery}
                onChange={(e) => {
                  setExamSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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

          {/* Textual Summary Row */}
          <div style={{ fontSize: 13.5, color: '#667085', marginBottom: 16 }}>
            <strong style={{ color: '#172033', fontWeight: 600 }}>{examsList.length} exam papers</strong>
            <span> · {pendingCount} pending review · {publishedCount} published</span>
          </div>

          {/* Compact Filter Row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Status Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#344054' }}>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #E4E7EC',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#172033',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  height: 38,
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending review</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>

            {/* Stage Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#344054' }}>Stage:</label>
              <select
                value={stageFilter}
                onChange={(e) => {
                  setStageFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #E4E7EC',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#172033',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  height: 38,
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">All</option>
                <option value="prelims">Prelims</option>
                <option value="mains">Mains</option>
              </select>
            </div>

            {/* Year Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#344054' }}>Year:</label>
              <select
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #E4E7EC',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#172033',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  height: 38,
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">All</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
              </select>
            </div>
          </div>

          {/* Primary Operations Table */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E4E7EC',
              borderRadius: 6,
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
              overflow: 'hidden',
            }}
          >
            {loadingExams ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#667085', fontSize: 13 }}>
                Loading examination papers...
              </div>
            ) : paginatedExams.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', color: '#667085' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#172033' }}>No examination papers found</div>
                <div style={{ fontSize: 13, color: '#667085', marginTop: 4 }}>
                  Try adjusting your search or filters.
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>EXAMINATION PAPER</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>CODE</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>STAGE & YEAR</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>EXTRACTED</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12 }}>STATUS</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#667085', fontSize: 12, textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExams.map((exam, i) => {
                    const statusObj = formatHumanStatus(exam.status);
                    const totalQ = exam.total_questions || 100;
                    const extQ = exam.extracted_questions_count || 0;
                    const pct = Math.min(100, Math.round((extQ / totalQ) * 100));

                    return (
                      <tr
                        key={exam.id}
                        onClick={() => setSelectedExam(exam)}
                        style={{
                          borderBottom: i === paginatedExams.length - 1 ? 'none' : '1px solid #E4E7EC',
                          cursor: 'pointer',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F7F5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* 1. EXAMINATION PAPER */}
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: '#172033', maxWidth: 300 }}>
                          {exam.name || `UPSC Prelims ${exam.source_year} GS Paper 1`}
                        </td>

                        {/* 2. CODE */}
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#667085' }}>
                          <div>{exam.code}</div>
                          {exam.paper_set_code && <div style={{ marginTop: 2 }}>{exam.paper_set_code}</div>}
                        </td>

                        {/* 3. STAGE & YEAR */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#172033', textTransform: 'capitalize' }}>
                            {exam.stage || 'Prelims'}
                          </div>
                          <div style={{ fontSize: 12.5, color: '#667085', marginTop: 1 }}>
                            {exam.source_year || 2024}
                          </div>
                        </td>

                        {/* 4. EXTRACTED QUESTIONS */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#172033' }}>
                            {extQ} / {totalQ}
                          </div>
                          <div style={{ width: 80, height: 4, background: '#F2F4F7', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                backgroundColor: pct === 100 ? '#15803D' : '#3B6EA8',
                              }}
                            />
                          </div>
                        </td>

                        {/* 5. STATUS */}
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              padding: '3px 8px',
                              borderRadius: 4,
                              backgroundColor: statusObj.bg,
                              color: statusObj.color,
                              border: `1px solid ${statusObj.border}`,
                              display: 'inline-block',
                            }}
                          >
                            {statusObj.label}
                          </span>
                        </td>

                        {/* 6. ACTION */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedExam(exam);
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
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 110, 168, 0.06)';
                              e.currentTarget.style.borderColor = '#3B6EA8';
                              e.currentTarget.style.color = '#3B6EA8';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFFFFF';
                              e.currentTarget.style.borderColor = '#E4E7EC';
                              e.currentTarget.style.color = '#172033';
                            }}
                          >
                            <span>Review</span>
                            <span>→</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Clean Pagination Footer */}
          {totalPapersCount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 16,
                fontSize: 13,
                color: '#667085',
              }}
            >
              <div>
                Showing {Math.min(startIndex + 1, totalPapersCount)}–
                {Math.min(startIndex + pageSize, totalPapersCount)} of {totalPapersCount} papers
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 4,
                    border: '1px solid #E4E7EC',
                    background: '#FFFFFF',
                    color: currentPage === 1 ? '#94A3B8' : '#172033',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 12.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 4,
                      border: '1px solid #E4E7EC',
                      background: currentPage === pg ? '#12233F' : '#FFFFFF',
                      color: currentPage === pg ? '#FFFFFF' : '#172033',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: currentPage === pg ? 600 : 400,
                    }}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 4,
                    border: '1px solid #E4E7EC',
                    background: '#FFFFFF',
                    color: currentPage === totalPages ? '#94A3B8' : '#172033',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: 12.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: SPLIT-PANE QUESTION REVIEW WORKSPACE FOR SELECTED EXAM */
        <div>
          {/* Top Breadcrumb Header Bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#667085', marginBottom: 6 }}>
              <span
                onClick={() => setSelectedExam(null)}
                style={{ cursor: 'pointer', textDecoration: 'none', color: '#3B6EA8', fontWeight: 500 }}
              >
                ← Back to Question Review
              </span>
              <span>/</span>
              <span style={{ color: '#172033', fontWeight: 600 }}>{selectedExam.name}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: '#172033', margin: 0 }}>
                  {selectedExam.name} ({selectedExam.code})
                </h1>
                <span style={{ fontSize: 13, color: '#667085', marginTop: 2, display: 'block' }}>
                  {questionsList.length} questions loaded from database
                </span>
              </div>

              {/* Question Status Filter for Workspace */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={questionStatusFilter}
                  onChange={(e) => setQuestionStatusFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #E4E7EC',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#172033',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    height: 38,
                  }}
                >
                  <option value="ALL">All Questions</option>
                  <option value="PENDING_HUMAN_REVIEW">Pending Review</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Split-Pane Question Workspace Layout */}
          {loadingQuestions ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#667085', background: '#FFFFFF', borderRadius: 6, border: '1px solid #E4E7EC' }}>
              <Loader2 size={24} className="animate-spin" color="#3B6EA8" style={{ marginBottom: 12 }} />
              <div>Loading exam questions from database...</div>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#667085', background: '#FFFFFF', borderRadius: 6, border: '1px solid #E4E7EC' }}>
              <FileText size={32} color="#667085" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#172033' }}>No questions found</div>
              <div style={{ fontSize: 13, color: '#667085', marginTop: 4 }}>
                No questions matched the selected status filter for this paper.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
              {/* Left Pane: Question Item List */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E7EC',
                  borderRadius: 6,
                  overflow: 'hidden',
                  maxHeight: 'calc(100vh - 220px)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Search Bar in Left List */}
                <div style={{ padding: 12, borderBottom: '1px solid #E4E7EC', backgroundColor: '#F7F7F5' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#667085' }} />
                    <input
                      type="text"
                      placeholder="Filter Q1, topic..."
                      value={questionSearchQuery}
                      onChange={(e) => setQuestionSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        borderRadius: 4,
                        border: '1px solid #E4E7EC',
                        fontSize: 12.5,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Scrollable Question Items */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredQuestions.map((q, idx) => {
                    const isSelected = selectedQuestionIndex === idx;
                    const isPub = q.status === 'PUBLISHED';
                    const isRej = q.status === 'REJECTED';

                    return (
                      <div
                        key={q.id}
                        onClick={() => setSelectedQuestionIndex(idx)}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid #E4E7EC',
                          backgroundColor: isSelected ? 'rgba(59, 110, 168, 0.08)' : '#FFFFFF',
                          borderLeft: isSelected ? '3px solid #3B6EA8' : '3px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>
                            Q{q.question_number_in_paper}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 3,
                              backgroundColor: isPub ? '#DCFCE7' : isRej ? '#FEF2F2' : '#FEF3C7',
                              color: isPub ? '#15803D' : isRej ? '#B42318' : '#B45309',
                            }}
                          >
                            {isPub ? 'Published' : isRej ? 'Rejected' : 'Pending'}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 12.5,
                            color: '#344054',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.4,
                          }}
                        >
                          {q.question_text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: Detailed Question Inspector & Review Actions */}
              {selectedQuestion && (
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E7EC',
                    borderRadius: 6,
                    padding: 24,
                    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.02)',
                  }}
                >
                  {/* Question Metadata Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #E4E7EC',
                      paddingBottom: 12,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: '#172033' }}>
                        Question #{selectedQuestion.question_number_in_paper}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 4,
                          backgroundColor:
                            selectedQuestion.status === 'PUBLISHED'
                              ? '#DCFCE7'
                              : selectedQuestion.status === 'REJECTED'
                              ? '#FEF2F2'
                              : '#FEF3C7',
                          color:
                            selectedQuestion.status === 'PUBLISHED'
                              ? '#15803D'
                              : selectedQuestion.status === 'REJECTED'
                              ? '#B42318'
                              : '#B45309',
                          border: `1px solid ${
                            selectedQuestion.status === 'PUBLISHED'
                              ? '#BBF7D0'
                              : selectedQuestion.status === 'REJECTED'
                              ? '#FECDCA'
                              : '#FDE68A'
                          }`,
                        }}
                      >
                        {selectedQuestion.status === 'PUBLISHED'
                          ? 'Published'
                          : selectedQuestion.status === 'REJECTED'
                          ? 'Rejected'
                          : 'Pending Review'}
                      </span>
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => openEditModal(selectedQuestion)}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: '#172033',
                          background: '#FFFFFF',
                          border: '1px solid #E4E7EC',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Edit3 size={14} /> Edit
                      </button>

                      <button
                        onClick={() => handleRejectQuestion(selectedQuestion.id)}
                        disabled={actionLoadingId === selectedQuestion.id}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: '#B42318',
                          background: '#FFFFFF',
                          border: '1px solid #FECDCA',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <ThumbsDown size={14} /> Reject
                      </button>

                      <button
                        onClick={() => handleApproveQuestion(selectedQuestion.id)}
                        disabled={actionLoadingId === selectedQuestion.id}
                        style={{
                          padding: '6px 14px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#FFFFFF',
                          background: '#12233F',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {actionLoadingId === selectedQuestion.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ThumbsUp size={14} />
                        )}
                        <span>Approve & Publish</span>
                      </button>
                    </div>
                  </div>

                  {/* Passage Text (if available) */}
                  {selectedQuestion.passage_text && (
                    <div
                      style={{
                        padding: 14,
                        background: '#F7F7F5',
                        borderLeft: '3px solid #3B6EA8',
                        borderRadius: 4,
                        fontSize: 13.5,
                        color: '#344054',
                        marginBottom: 16,
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Passage Context:</strong> {selectedQuestion.passage_text}
                    </div>
                  )}

                  {/* Question Stem Text */}
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#172033', lineHeight: 1.6, marginBottom: 20 }}>
                    {selectedQuestion.question_text}
                  </div>

                  {/* Options List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                    {selectedQuestion.options.map((opt) => (
                      <div
                        key={opt.option_label}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 6,
                          border: opt.is_correct ? '1.5px solid #15803D' : '1px solid #E4E7EC',
                          backgroundColor: opt.is_correct ? '#F0FDF4' : '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            backgroundColor: opt.is_correct ? '#15803D' : '#F7F7F5',
                            color: opt.is_correct ? '#FFFFFF' : '#344054',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {opt.option_label}
                        </span>

                        <span style={{ fontSize: 13.5, color: '#172033', flex: 1 }}>{opt.option_text}</span>

                        {opt.is_correct && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#15803D', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={14} /> Correct Answer
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Solution Explanation */}
                  {selectedQuestion.explanation?.detailed_solution && (
                    <div
                      style={{
                        padding: 16,
                        backgroundColor: '#F7F7F5',
                        border: '1px solid #E4E7EC',
                        borderRadius: 6,
                      }}
                    >
                      <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#172033', margin: '0 0 8px 0' }}>
                        Solution Explanation
                      </h4>
                      <p style={{ fontSize: 13, color: '#344054', margin: 0, lineHeight: 1.6 }}>
                        {selectedQuestion.explanation.detailed_solution}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* QUESTION EDIT MODAL */}
      {editingQuestion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(16, 33, 61, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 8,
              border: '1px solid #E4E7EC',
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 4px 12px rgba(16, 24, 40, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#172033', margin: 0 }}>
                Edit Question #{editingQuestion.question_number_in_paper}
              </h2>
              <button
                onClick={() => setEditingQuestion(null)}
                style={{ background: 'none', border: 'none', color: '#667085', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                Question Text
              </label>
              <textarea
                rows={4}
                value={editFormText}
                onChange={(e) => setEditFormText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 6,
                  border: '1px solid #E4E7EC',
                  fontSize: 13.5,
                  color: '#172033',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Options Editing */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 8 }}>
                Options & Correct Answer
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {editFormOptions.map((opt, idx) => (
                  <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#172033', width: 20 }}>
                      {opt.label}.
                    </span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const newOpts = [...editFormOptions];
                        newOpts[idx].text = e.target.value;
                        setEditFormOptions(newOpts);
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: 4,
                        border: '1px solid #E4E7EC',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, cursor: 'pointer', color: '#172033' }}>
                      <input
                        type="radio"
                        name="correctOpt"
                        checked={opt.is_correct}
                        onChange={() => {
                          const newOpts = editFormOptions.map((o, i) => ({
                            ...o,
                            is_correct: i === idx,
                          }));
                          setEditFormOptions(newOpts);
                        }}
                      />
                      Correct
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution Explanation */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#344054', marginBottom: 6 }}>
                Solution Explanation
              </label>
              <textarea
                rows={3}
                value={editFormExplanation}
                onChange={(e) => setEditFormExplanation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 6,
                  border: '1px solid #E4E7EC',
                  fontSize: 13.5,
                  color: '#172033',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setEditingQuestion(null)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#667085',
                  background: '#FFFFFF',
                  border: '1px solid #E4E7EC',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuestionEdit}
                disabled={savingEdit}
                style={{
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  background: '#12233F',
                  border: 'none',
                  borderRadius: 6,
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save & Publish</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
