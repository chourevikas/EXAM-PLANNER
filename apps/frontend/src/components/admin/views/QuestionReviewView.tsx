import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Edit3, 
  Search, 
  ArrowLeft, 
  BookOpen, 
  Filter, 
  Loader2, 
  Save, 
  X, 
  Check, 
  FileText,
  HelpCircle,
  Clock,
  Zap
} from 'lucide-react';
import { 
  fetchExamPipelineStatuses, 
  fetchQuestionsByExam, 
  updateAdminQuestionDetail, 
  updateAdminQuestionStatus,
  ExamPipelineStatusItem 
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
  // Navigation State: null = showing Exam List view, string = selected exam ID
  const [selectedExam, setSelectedExam] = useState<ExamPipelineStatusItem | null>(null);
  
  // Data States
  const [examsList, setExamsList] = useState<ExamPipelineStatusItem[]>([]);
  const [questionsList, setQuestionsList] = useState<QuestionDetailItem[]>([]);
  
  // Loading & Feedback States
  const [loadingExams, setLoadingExams] = useState<boolean>(true);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Filters
  const [examSearchQuery, setExamSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, PENDING_HUMAN_REVIEW, PUBLISHED, REJECTED

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
      loadQuestions(selectedExam, statusFilter);
    }
  }, [selectedExam, statusFilter]);

  const loadExams = async () => {
    setLoadingExams(true);
    setErrorMsg('');
    try {
      const data = await fetchExamPipelineStatuses();
      setExamsList(data);
    } catch (err: any) {
      console.error('Failed to load exams list:', err);
      setErrorMsg(err.message || 'Could not load exams from server.');
    } finally {
      setLoadingExams(false);
    }
  };

  const loadQuestions = async (exam: ExamPipelineStatusItem, status?: string) => {
    setLoadingQuestions(true);
    setErrorMsg('');
    try {
      let res = await fetchQuestionsByExam(exam.id, 1, 100, status);
      
      // Fallback 1: If 0 questions returned by exam.id, try querying by paper_set_code & exam_year
      if ((!res.items || res.items.length === 0) && (exam.paper_set_code || exam.source_year)) {
        let fallbackUrl = `/api/v1/questions?page=1&limit=100`;
        if (exam.paper_set_code) fallbackUrl += `&paper_set_code=${exam.paper_set_code}`;
        if (exam.source_year) fallbackUrl += `&exam_year=${exam.source_year}`;
        if (status && status !== 'ALL') fallbackUrl += `&status=${status}`;
        
        const token = localStorage.getItem('access_token');
        const fallbackRes = await fetch(fallbackUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (fallbackData.items && fallbackData.items.length > 0) {
            res = fallbackData;
          }
        }
      }

      // Map API items to uniform frontend interface
      const items = (res.items || []).map((q: any) => ({
        id: q.question_id || q.id,
        question_number_in_paper: q.question_number_in_paper || 1,
        question_type: q.question_type || 'SINGLE_CHOICE',
        difficulty: q.difficulty || 'MEDIUM',
        marks: q.marks || 2.0,
        status: q.status || 'PENDING_HUMAN_REVIEW',
        question_text: q.question_text || 'No question text available',
        passage_text: q.passage_text,
        subject_name: q.subject_name || q.hierarchy?.[0]?.subject_name || q.hierarchy_links?.[0]?.subject_name,
        topic_name: q.topic_name || q.hierarchy?.[0]?.topic_name || q.hierarchy_links?.[0]?.topic_name,
        subtopic_name: q.subtopic_name || q.hierarchy?.[0]?.subtopic_name || q.hierarchy_links?.[0]?.subtopic_name,
        options: (q.options || []).map((opt: any, idx: number) => ({
          option_id: opt.option_id || opt.id,
          option_label: opt.option_label || String.fromCharCode(65 + idx),
          option_text: opt.option_text || opt.text || '',
          is_correct: Boolean(opt.is_correct),
          display_order: opt.display_order || idx + 1
        })),
        explanation: {
          core_concept: q.explanation?.core_concept,
          detailed_solution: q.explanation?.detailed_solution || (typeof q.explanation === 'string' ? q.explanation : '')
        }
      }));
      setQuestionsList(items);
    } catch (err: any) {
      console.error('Failed to load questions:', err);
      setErrorMsg(err.message || 'Could not load questions for this exam.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleApproveQuestion = async (questionId: string) => {
    setActionLoadingId(questionId);
    setErrorMsg('');
    try {
      await updateAdminQuestionStatus(questionId, 'PUBLISHED');
      setQuestionsList(prev => prev.map(q => q.id === questionId ? { ...q, status: 'PUBLISHED' } : q));
      setSuccessMsg('Question approved & published successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to approve question:', err);
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
      setQuestionsList(prev => prev.map(q => q.id === questionId ? { ...q, status: 'REJECTED' } : q));
      setSuccessMsg('Question status marked as Rejected.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to reject question:', err);
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
    
    // Setup 4 options (A, B, C, D)
    const formattedOpts = ['A', 'B', 'C', 'D'].map((label, idx) => {
      const existing = q.options.find(o => o.option_label.toUpperCase() === label) || q.options[idx];
      return {
        label,
        text: existing ? existing.option_text : '',
        is_correct: existing ? existing.is_correct : idx === 0
      };
    });
    setEditFormOptions(formattedOpts);
  };

  const handleOptionCorrectChange = (targetLabel: string) => {
    setEditFormOptions(prev => prev.map(o => ({
      ...o,
      is_correct: o.label === targetLabel
    })));
  };

  const handleOptionTextChange = (label: string, text: string) => {
    setEditFormOptions(prev => prev.map(o => o.label === label ? { ...o, text } : o));
  };

  const handleSaveQuestionEdit = async () => {
    if (!editingQuestion) return;
    setSavingEdit(true);
    setErrorMsg('');
    try {
      const payload = {
        question_text: editFormText,
        difficulty: editFormDifficulty,
        status: 'PUBLISHED', // Auto-publish edited questions
        options: editFormOptions.map(o => ({
          option_label: o.label,
          option_text: o.text,
          is_correct: o.is_correct
        })),
        detailed_solution: editFormExplanation
      };

      const updated = await updateAdminQuestionDetail(editingQuestion.id, payload);

      setQuestionsList(prev => prev.map(q => {
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
              display_order: idx + 1
            })),
            explanation: {
              detailed_solution: editFormExplanation
            }
          };
        }
        return q;
      }));

      setSuccessMsg('Question and options updated & published successfully!');
      setEditingQuestion(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to update question:', err);
      setErrorMsg(err.message || 'Could not update question details.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Filtered Exams list based on search
  const filteredExams = examsList.filter(ex => 
    ex.name?.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
    ex.code?.toLowerCase().includes(examSearchQuery.toLowerCase()) ||
    ex.source_year?.toString().includes(examSearchQuery)
  );

  return (
    <div style={{ padding: 0, maxWidth: 1440, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>
      
      {/* Alert Notifications */}
      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* VIEW 1: EXAM SELECTOR GRID */}
      {!selectedExam ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Header Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #059669, #047857)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}>
                  <ClipboardCheck size={22} />
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                    Question Review & Verification Queue
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    Select an extracted exam from S3/DB to inspect, edit question stems, option choices, answers, and solution explanations.
                  </p>
                </div>
              </div>
            </div>

            {/* Search Box for Exams */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderRadius: 10, padding: '8px 14px', border: '1px solid #cbd5e1', width: 320, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search exam by code, title, or year..."
                value={examSearchQuery}
                onChange={(e) => setExamSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 13,
                  color: '#0f172a',
                  width: '100%'
                }}
              />
            </div>
          </div>

          {/* Exam Cards Grid */}
          {loadingExams ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: '#2563eb' }}>
              <Loader2 className="animate-spin" size={26} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Loading live exam papers from server...</span>
            </div>
          ) : filteredExams.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 60, textAlign: 'center', color: '#64748b' }}>
              <BookOpen size={36} color="#cbd5e1" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>No exam papers found</div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Upload question paper PDFs via the Upload tab to populate the review queue.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {filteredExams.map((exam) => {
                const totalQ = exam.total_questions || 100;
                const extractedQ = exam.extracted_questions_count || 0;
                const progressPct = Math.round((extractedQ / totalQ) * 100);

                return (
                  <div
                    key={exam.id}
                    onClick={() => setSelectedExam(exam)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 18,
                      padding: 20,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.boxShadow = '0 12px 28px rgba(37,99,235,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.03)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {exam.code} • {exam.paper_set_code}
                        </span>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'var(--font-display)' }}>
                          {exam.name || `Exam ${exam.source_year}`}
                        </h3>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, backgroundColor: exam.status === 'PUBLISHED' ? '#ecfdf5' : '#eff6ff', color: exam.status === 'PUBLISHED' ? '#059669' : '#2563eb', border: `1px solid ${exam.status === 'PUBLISHED' ? '#a7f3d0' : '#bfdbfe'}` }}>
                        {exam.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      <span>Year: <strong>{exam.source_year}</strong></span>
                      <span>•</span>
                      <span>Stage: <strong>{exam.stage}</strong></span>
                    </div>

                    {/* Progress Indicator */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
                        <span style={{ color: '#64748b' }}>Extracted Questions</span>
                        <span style={{ color: '#0f172a', fontFamily: 'var(--font-mono)' }}>{extractedQ} / {totalQ}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(progressPct, 100)}%`, height: '100%', backgroundColor: progressPct >= 100 ? '#10b981' : '#2563eb', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: EXAM QUESTIONS REVIEW WORKSPACE */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Header Workspace Controls */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '20px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={() => setSelectedExam(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <ArrowLeft size={16} />
                <span>Back to Exam List</span>
              </button>

              <div style={{ height: 24, width: 1, backgroundColor: '#e2e8f0' }} />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'var(--font-display)' }}>
                    {selectedExam.name}
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 8, backgroundColor: '#eff6ff', color: '#2563eb', fontFamily: 'var(--font-mono)' }}>
                    {selectedExam.paper_set_code}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'block' }}>
                  {selectedExam.code} • Year {selectedExam.source_year} • {questionsList.length} Questions Loaded
                </span>
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12 }}>
              {[
                { id: 'ALL', label: 'All Questions' },
                { id: 'PENDING_HUMAN_REVIEW', label: 'Pending Review' },
                { id: 'PUBLISHED', label: 'Approved & Published' },
                { id: 'REJECTED', label: 'Rejected' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: statusFilter === tab.id ? '#ffffff' : 'transparent',
                    color: statusFilter === tab.id ? '#0f172a' : '#64748b',
                    fontSize: 12,
                    fontWeight: statusFilter === tab.id ? 700 : 600,
                    cursor: 'pointer',
                    boxShadow: statusFilter === tab.id ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question List Cards */}
          {loadingQuestions ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#2563eb' }}>
              <Loader2 className="animate-spin" size={26} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Loading questions for {selectedExam.code}...</span>
            </div>
          ) : questionsList.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 60, textAlign: 'center', color: '#64748b' }}>
              <FileText size={36} color="#cbd5e1" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>No questions found</div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>There are no questions matching status filter '{statusFilter}'.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {questionsList.map((q) => {
                const isApproved = q.status === 'PUBLISHED';
                const isRejected = q.status === 'REJECTED';

                return (
                  <div 
                    key={q.id} 
                    style={{ 
                      background: '#ffffff', 
                      border: `1px solid ${isApproved ? '#a7f3d0' : isRejected ? '#fecaca' : '#e2e8f0'}`, 
                      borderRadius: 18, 
                      padding: 22,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14
                    }}
                  >
                    {/* Card Header Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', backgroundColor: '#0f1e3c', padding: '4px 10px', borderRadius: 8, fontFamily: 'var(--font-mono)' }}>
                          Q{q.question_number_in_paper}
                        </span>

                        {q.subject_name && (
                          <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', padding: '3px 9px', borderRadius: 12, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                            {q.subject_name}
                          </span>
                        )}

                        <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#f8fafc', color: '#64748b', padding: '3px 9px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)' }}>
                          {q.difficulty}
                        </span>

                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, backgroundColor: isApproved ? '#ecfdf5' : isRejected ? '#fef2f2' : '#fffbe8', color: isApproved ? '#059669' : isRejected ? '#dc2626' : '#b45309', border: `1px solid ${isApproved ? '#a7f3d0' : isRejected ? '#fecaca' : '#fde68a'}` }}>
                          {isApproved ? 'Approved & Published ✅' : isRejected ? 'Rejected ❌' : 'Pending Review ⏳'}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => openEditModal(q)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '7px 12px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                            e.currentTarget.style.borderColor = '#93c5fd';
                            e.currentTarget.style.color = '#2563eb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.color = '#0f172a';
                          }}
                        >
                          <Edit3 size={14} />
                          <span>Edit Q & A</span>
                        </button>

                        <button
                          disabled={actionLoadingId === q.id}
                          onClick={() => handleApproveQuestion(q.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '7px 14px',
                            borderRadius: 8,
                            border: `1px solid ${isApproved ? '#059669' : '#10b981'}`,
                            backgroundColor: isApproved ? '#ecfdf5' : '#10b981',
                            color: isApproved ? '#059669' : '#ffffff',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: actionLoadingId === q.id ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {actionLoadingId === q.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <ThumbsUp size={14} />
                              <span>{isApproved ? 'Approved ✅' : 'Approve & Publish'}</span>
                            </>
                          )}
                        </button>

                        <button
                          disabled={actionLoadingId === q.id}
                          onClick={() => handleRejectQuestion(q.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '7px 12px',
                            borderRadius: 8,
                            border: `1px solid ${isRejected ? '#dc2626' : '#ef4444'}`,
                            backgroundColor: isRejected ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)',
                            color: isRejected ? '#dc2626' : '#dc2626',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: actionLoadingId === q.id ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {actionLoadingId === q.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <ThumbsDown size={14} />
                              <span>{isRejected ? 'Rejected ❌' : 'Reject'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Question Stem Text */}
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {q.question_text}
                    </div>

                    {/* Options Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                      {q.options.map((opt) => (
                        <div
                          key={opt.option_label}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            backgroundColor: opt.is_correct ? '#ecfdf5' : '#f8fafc',
                            border: `1px solid ${opt.is_correct ? '#a7f3d0' : '#e2e8f0'}`,
                            fontSize: 13,
                            color: opt.is_correct ? '#065f46' : '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontWeight: opt.is_correct ? 700 : 500
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, color: opt.is_correct ? '#059669' : '#2563eb', fontFamily: 'var(--font-mono)' }}>
                              {opt.option_label}.
                            </span>
                            <span>{opt.option_text || <em>(Empty option text)</em>}</span>
                          </div>
                          {opt.is_correct && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: 6 }}>
                              Correct Answer
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Explanation / Solution Description Box */}
                    {q.explanation?.detailed_solution && (
                      <div style={{ padding: 14, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <HelpCircle size={14} />
                          <span>Solution Explanation & Description</span>
                        </div>
                        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                          {q.explanation.detailed_solution}
                        </p>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* INTERACTIVE QUESTION EDIT MODAL DRAWER */}
      {editingQuestion && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div 
            style={{ 
              width: '100%', 
              maxWidth: 720, 
              maxHeight: '90vh',
              backgroundColor: '#ffffff', 
              borderRadius: 20, 
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)', 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid #e2e8f0'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', backgroundColor: '#0f1e3c', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Edit3 size={20} color="#60a5fa" />
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)' }}>
                  Edit Question Q{editingQuestion.question_number_in_paper} & Answer Choices
                </h3>
              </div>
              <button 
                onClick={() => setEditingQuestion(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 6, borderRadius: 8 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
              
              {/* Question Text Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Question Stem Text
                </label>
                <textarea
                  rows={4}
                  value={editFormText}
                  onChange={(e) => setEditFormText(e.target.value)}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 14,
                    color: '#0f172a',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Options A, B, C, D Inputs & Radio Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Option Choices (Select Radio Button for Correct Answer)
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {editFormOptions.map((opt) => (
                    <div 
                      key={opt.label}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12, 
                        padding: 12, 
                        borderRadius: 10, 
                        border: `1px solid ${opt.is_correct ? '#10b981' : '#cbd5e1'}`, 
                        backgroundColor: opt.is_correct ? '#f0fdf4' : '#ffffff' 
                      }}
                    >
                      <input
                        type="radio"
                        name="correctOptionRadio"
                        checked={opt.is_correct}
                        onChange={() => handleOptionCorrectChange(opt.label)}
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#10b981' }}
                      />

                      <span style={{ fontSize: 14, fontWeight: 800, color: opt.is_correct ? '#059669' : '#2563eb', fontFamily: 'var(--font-mono)', width: 20 }}>
                        {opt.label}.
                      </span>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionTextChange(opt.label, e.target.value)}
                        placeholder={`Option ${opt.label} content...`}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                          color: '#0f172a',
                          outline: 'none'
                        }}
                      />

                      {opt.is_correct && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', backgroundColor: '#d1fae5', padding: '3px 8px', borderRadius: 6 }}>
                          Correct
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Difficulty Level Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Difficulty Rating
                </label>
                <select
                  value={editFormDifficulty}
                  onChange={(e) => setEditFormDifficulty(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    color: '#0f172a',
                    outline: 'none'
                  }}
                >
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>

              {/* Explanation / Description Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Solution Explanation / Description
                </label>
                <textarea
                  rows={4}
                  value={editFormExplanation}
                  onChange={(e) => setEditFormExplanation(e.target.value)}
                  placeholder="Provide step-by-step solution, references, or core concept explanations..."
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    color: '#0f172a',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setEditingQuestion(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                disabled={savingEdit}
                onClick={handleSaveQuestionEdit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 20px',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: savingEdit ? 'not-allowed' : 'pointer'
                }}
              >
                {savingEdit ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save & Publish Changes</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
