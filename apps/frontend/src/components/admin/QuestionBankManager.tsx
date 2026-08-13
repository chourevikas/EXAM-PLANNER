import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  Tag, 
  Layers, 
  HelpCircle, 
  Loader2, 
  ChevronRight, 
  FileText, 
  Sparkles,
  Scale,
  TrendingUp,
  Landmark,
  Globe,
  Cpu,
  TreePine,
  Newspaper
} from 'lucide-react';
import { fetchCatalogQuestions } from '../../services/adminService';

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

interface SubjectCardInfo {
  id: string;
  name: string;
  code: string;
  icon: any;
  color: string;
  bgGradient: string;
  borderColor: string;
  description: string;
}

export function QuestionBankManager() {
  // Navigation State: null = showing Subject Flash Cards view, string = selected subject name
  const [selectedSubject, setSelectedSubject] = useState<SubjectCardInfo | null>(null);

  // Questions & Loading States
  const [questions, setQuestions] = useState<QuestionCatalogItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Subject Flash Cards Definition
  const subjectCards: SubjectCardInfo[] = [
    {
      id: 'polity',
      name: 'Polity',
      code: 'POLITY',
      icon: Scale,
      color: '#2563eb',
      bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      borderColor: '#93c5fd',
      description: 'Indian Constitution, Governance, Rights Issues, Executive, Judiciary & Federal Structure.'
    },
    {
      id: 'economy',
      name: 'Economy',
      code: 'ECONOMY',
      icon: TrendingUp,
      color: '#059669',
      bgGradient: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
      borderColor: '#6ee7b7',
      description: 'Indian Economy, Monetary Policy, Banking, Inflation, Fiscal System & Agriculture.'
    },
    {
      id: 'history',
      name: 'History',
      code: 'HISTORY',
      icon: Landmark,
      color: '#d97706',
      bgGradient: 'linear-gradient(135deg, #fffbe8 0%, #fef3c7 100%)',
      borderColor: '#fcd34d',
      description: 'Ancient, Medieval, Modern Indian Freedom Struggle, Art & Culture.'
    },
    {
      id: 'geography',
      name: 'Geography',
      code: 'GEOGRAPHY',
      icon: Globe,
      color: '#0284c7',
      bgGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      borderColor: '#7dd3fc',
      description: 'Physical Geography, Climatology, Indian & World Physical & Economic Geography.'
    },
    {
      id: 'science',
      name: 'Science & Technology',
      code: 'SCIENCE',
      icon: Cpu,
      color: '#7c3aed',
      bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
      borderColor: '#c4b5fd',
      description: 'Space Tech, Biotechnology, Defense, IT, Nanotech & Everyday General Science.'
    },
    {
      id: 'environment',
      name: 'Environment',
      code: 'ENVIRONMENT',
      icon: TreePine,
      color: '#16a34a',
      bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      borderColor: '#86efac',
      description: 'Ecology, Biodiversity Conservation, Climate Change & Environmental Laws.'
    },
    {
      id: 'current',
      name: 'Current Affairs',
      code: 'CURRENT_AFFAIRS',
      icon: Newspaper,
      color: '#db2777',
      bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
      borderColor: '#f9a8d4',
      description: 'National & International Events, Reports, Indices & Government Schemes.'
    }
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
      
      const mapped = (data.items || []).map((q: any) => ({
        id: q.question_id || q.id,
        question_number_in_paper: q.question_number_in_paper || 1,
        question_type: q.question_type || 'SINGLE_CHOICE',
        difficulty: q.difficulty || 'MEDIUM',
        marks: q.marks || 2.0,
        status: q.status || 'PENDING_HUMAN_REVIEW',
        question_text: q.question_text || 'No question text stem available',
        passage_text: q.passage_text,
        exam_name: q.exam_name,
        exam_code: q.exam_code,
        source_year: q.source_year,
        subject_name: q.subject_name || q.hierarchy?.[0]?.subject_name || subjectName,
        topic_name: q.topic_name || q.hierarchy?.[0]?.topic_name || 'Core Topic',
        subtopic_name: q.subtopic_name || q.hierarchy?.[0]?.subtopic_name || 'Mapped Subtopic',
        subtopic_code: q.subtopic_code || q.hierarchy?.[0]?.subtopic_code || 'SUB-01',
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

      setQuestions(mapped);
    } catch (err: any) {
      console.error('Failed to load questions for subject:', err);
      setErrorMsg(err.message || 'Could not load questions from server.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Search filter
  const filteredQuestions = questions.filter(q => {
    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (
      q.question_text.toLowerCase().includes(term) ||
      q.subtopic_name?.toLowerCase().includes(term) ||
      q.topic_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ padding: 0, maxWidth: 1440, margin: '0 auto', fontFamily: 'var(--font-sans, sans-serif)' }}>
      
      {/* Error Alert */}
      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* LEVEL 1: SUBJECT FLASH CARDS GRID VIEW */}
      {!selectedSubject ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Header Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}>
                <BookOpen size={24} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Question Bank Subjects
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  Select a subject flash card to explore real database questions and mapped subtopics.
                </p>
              </div>
            </div>
          </div>

          {/* Flash Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 22 }}>
            {subjectCards.map((card) => {
              const IconComp = card.icon;

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedSubject(card)}
                  style={{
                    background: '#ffffff',
                    border: `1px solid ${card.borderColor}`,
                    borderRadius: 20,
                    padding: 24,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 20,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 14px 30px rgba(0,0,0,0.08)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)';
                  }}
                >
                  {/* Decorative Gradient Background Banner */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: card.color }} />

                  <div>
                    {/* Top Icon & Code Tag */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 14, background: card.bgGradient, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${card.borderColor}` }}>
                        <IconComp size={22} />
                      </div>

                      <span style={{ fontSize: 11, fontWeight: 800, color: card.color, backgroundColor: card.bgGradient, padding: '4px 10px', borderRadius: 8, fontFamily: 'var(--font-mono)', border: `1px solid ${card.borderColor}` }}>
                        {card.code}
                      </span>
                    </div>

                    {/* Card Title */}
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', fontFamily: 'var(--font-display)' }}>
                      {card.name}
                    </h3>

                    {/* Description */}
                    <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                      {card.description}
                    </p>
                  </div>

                  {/* Card Footer Button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: card.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Explore Questions</span>
                      <ChevronRight size={16} />
                    </span>

                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={14} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        /* LEVEL 2: SUBJECT QUESTION EXPLORER BOX VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Header Workspace Bar */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '20px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              
              {/* Back Button */}
              <button
                onClick={() => setSelectedSubject(null)}
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
                <span>Back to Subject Cards</span>
              </button>

              <div style={{ height: 24, width: 1, backgroundColor: '#e2e8f0' }} />

              {/* Subject Title */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'var(--font-display)' }}>
                    {selectedSubject.name} Questions
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 8, backgroundColor: selectedSubject.bgGradient, color: selectedSubject.color, border: `1px solid ${selectedSubject.borderColor}`, fontFamily: 'var(--font-mono)' }}>
                    {selectedSubject.code}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'block' }}>
                  {questions.length} Questions Cataloged in Database
                </span>
              </div>
            </div>

            {/* Search Box */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderRadius: 10, padding: '8px 14px', border: '1px solid #cbd5e1', width: 300 }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search questions or subtopics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Question Cards Box List */}
          {loadingQuestions ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#2563eb' }}>
              <Loader2 className="animate-spin" size={26} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Loading live questions for {selectedSubject.name}...</span>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 60, textAlign: 'center', color: '#64748b' }}>
              <BookOpen size={36} color="#cbd5e1" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>No questions found</div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>No questions currently match search filter '{searchQuery}'.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {filteredQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 18,
                    padding: 24,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16
                  }}
                >
                  {/* Question Box Top Tag Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      
                      {/* Q Number Badge */}
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#ffffff', backgroundColor: '#0f1e3c', padding: '4px 10px', borderRadius: 8, fontFamily: 'var(--font-mono)' }}>
                        Q{idx + 1}
                      </span>

                      {/* Subtopic Path Tag */}
                      <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#f8fafc', color: '#334155', padding: '4px 10px', borderRadius: 10, border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Tag size={12} color="#2563eb" />
                        <span>{q.topic_name} → <strong>{q.subtopic_name}</strong></span>
                      </span>

                      {/* Difficulty Chip */}
                      <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: 10, fontFamily: 'var(--font-mono)' }}>
                        {q.difficulty}
                      </span>
                    </div>

                    {/* Verification Status Tag */}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10, backgroundColor: q.status === 'PUBLISHED' ? '#ecfdf5' : '#fffbe8', color: q.status === 'PUBLISHED' ? '#059669' : '#b45309', border: `1px solid ${q.status === 'PUBLISHED' ? '#a7f3d0' : '#fde68a'}` }}>
                      {q.status === 'PUBLISHED' ? 'Verified ✅' : 'Pending Review ⏳'}
                    </span>
                  </div>

                  {/* Question Stem Text */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {q.question_text}
                  </div>

                  {/* Options Choice Grid */}
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

                  {/* Solution Explanation Box */}
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
              ))}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
