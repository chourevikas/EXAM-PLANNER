import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  HelpCircle,
  Sparkles,
  Layers,
  FileText,
  Tag
} from 'lucide-react';
import {
  createAdminQuestion,
  fetchMasterSyllabus,
  verifySyllabusTaxonomy,
  QuestionCreatePayload,
  QuestionOptionPayload
} from '../../../services/adminService';

interface AddMissingQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: {
    id: string | number;
    name?: string;
    code?: string;
    paper_set_code?: string;
    missing_question_numbers?: number[];
  } | null;
  initialQuestionNumber?: number | null;
  onSuccess: (newQ?: any) => void;
}

export function AddMissingQuestionModal({
  isOpen,
  onClose,
  exam,
  initialQuestionNumber,
  onSuccess
}: AddMissingQuestionModalProps) {
  if (!isOpen || !exam) return null;

  // Basic Form State
  const [questionNumber, setQuestionNumber] = useState<number>(
    initialQuestionNumber || (exam.missing_question_numbers && exam.missing_question_numbers.length > 0 ? exam.missing_question_numbers[0] : 1)
  );
  const [paperSetCode, setPaperSetCode] = useState<string>(exam.paper_set_code || 'SET_A');
  const [questionText, setQuestionText] = useState<string>('');
  const [passageText, setPassageText] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('MEDIUM');
  const [marks, setMarks] = useState<number>(2.0);
  const [negativeMarks, setNegativeMarks] = useState<number>(0.66);
  const [expectedTime, setExpectedTime] = useState<number>(60);

  // Options State (A, B, C, D)
  const [options, setOptions] = useState<QuestionOptionPayload[]>([
    { option_label: 'A', display_order: 1, option_text: '', is_correct: true, distractor_analysis: '' },
    { option_label: 'B', display_order: 2, option_text: '', is_correct: false, distractor_analysis: '' },
    { option_label: 'C', display_order: 3, option_text: '', is_correct: false, distractor_analysis: '' },
    { option_label: 'D', display_order: 4, option_text: '', is_correct: false, distractor_analysis: '' },
  ]);

  // Solution State

  const [detailedSolution, setDetailedSolution] = useState<string>('');
  const [commonTraps, setCommonTraps] = useState<string[]>([]);
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [newTrap, setNewTrap] = useState<string>('');
  const [newTakeaway, setNewTakeaway] = useState<string>('');

  // Taxonomy & Syllabus Hierarchy State
  const [syllabusTree, setSyllabusTree] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>('');
  const [availableTopics, setAvailableTopics] = useState<any[]>([]);
  const [availableSubtopics, setAvailableSubtopics] = useState<any[]>([]);
  const [taxonomyVerified, setTaxonomyVerified] = useState<boolean | null>(null);

  // Status & UI State
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load Syllabus Tree on Mount
  useEffect(() => {
    let isMounted = true;
    fetchMasterSyllabus(exam.id)
      .then((data) => {
        if (!isMounted) return;
        const subjects = data.subjects || data.subjects_list || [];
        setSyllabusTree(Array.isArray(subjects) ? subjects : []);
        if (Array.isArray(subjects) && subjects.length > 0) {
          const firstSubj = typeof subjects[0] === 'string' ? subjects[0] : subjects[0].name;
          setSelectedSubject(firstSubj);
        }
      })
      .catch((err) => {
        console.warn('Failed to load syllabus for missing question modal:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [exam.id]);

  // Update Topic List when Subject changes
  useEffect(() => {
    if (!selectedSubject || syllabusTree.length === 0) {
      setAvailableTopics([]);
      setSelectedTopic('');
      return;
    }

    const subjObj = syllabusTree.find(
      (s) => (typeof s === 'string' ? s : s.name) === selectedSubject
    );

    if (subjObj && typeof subjObj === 'object' && subjObj.topics) {
      setAvailableTopics(subjObj.topics);
      if (subjObj.topics.length > 0) {
        setSelectedTopic(subjObj.topics[0].name || '');
      } else {
        setSelectedTopic('');
      }
    } else {
      setAvailableTopics([]);
      setSelectedTopic('');
    }
  }, [selectedSubject, syllabusTree]);

  // Update Subtopic List when Topic changes
  useEffect(() => {
    if (!selectedTopic || availableTopics.length === 0) {
      setAvailableSubtopics([]);
      setSelectedSubtopic('');
      return;
    }

    const topObj = availableTopics.find((t) => t.name === selectedTopic);
    if (topObj && topObj.subtopics) {
      setAvailableSubtopics(topObj.subtopics);
      if (topObj.subtopics.length > 0) {
        setSelectedSubtopic(topObj.subtopics[0].name || '');
      } else {
        setSelectedSubtopic('');
      }
    } else {
      setAvailableSubtopics([]);
      setSelectedSubtopic('');
    }
  }, [selectedTopic, availableTopics]);

  // Verify Taxonomy Selection
  useEffect(() => {
    if (selectedSubject && selectedTopic) {
      verifySyllabusTaxonomy(selectedSubject, selectedTopic, selectedSubtopic)
        .then((res) => {
          setTaxonomyVerified(Boolean(res?.is_valid));
        })
        .catch(() => {
          setTaxonomyVerified(true);
        });
    }
  }, [selectedSubject, selectedTopic, selectedSubtopic]);

  const handleCorrectOptionChange = (index: number) => {
    setOptions((prev) =>
      prev.map((opt, idx) => ({
        ...opt,
        is_correct: idx === index,
      }))
    );
  };

  const handleOptionTextChange = (index: number, text: string) => {
    setOptions((prev) =>
      prev.map((opt, idx) => (idx === index ? { ...opt, option_text: text } : opt))
    );
  };

  const handleAddTrap = () => {
    if (newTrap.trim()) {
      setCommonTraps((prev) => [...prev, newTrap.trim()]);
      setNewTrap('');
    }
  };

  const handleRemoveTrap = (idx: number) => {
    setCommonTraps((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddTakeaway = () => {
    if (newTakeaway.trim()) {
      setKeyTakeaways((prev) => [...prev, newTakeaway.trim()]);
      setNewTakeaway('');
    }
  };

  const handleRemoveTakeaway = (idx: number) => {
    setKeyTakeaways((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!questionText.trim()) {
      setErrorMsg('Question statement text cannot be empty.');
      return;
    }

    const emptyOptions = options.filter((o) => !o.option_text.trim());
    if (emptyOptions.length > 0) {
      setErrorMsg('All 4 answer options (A, B, C, D) must have text.');
      return;
    }

    const hasCorrect = options.some((o) => o.is_correct);
    if (!hasCorrect) {
      setErrorMsg('You must mark one option as the correct answer.');
      return;
    }

    setLoading(true);
    try {
      const payload: QuestionCreatePayload = {
        exam_id: exam.id,
        question_number_in_paper: questionNumber,
        paper_set_code: paperSetCode,
        question_text: questionText.trim(),
        passage_text: passageText.trim() || undefined,
        difficulty: difficulty,
        marks: marks,
        negative_marks: negativeMarks,
        expected_time_seconds: expectedTime,
        options: options,
        detailed_solution: detailedSolution.trim() || undefined,
        common_traps: commonTraps,
        key_takeaways: keyTakeaways,
        subject_name: selectedSubject || undefined,
        topic_name: selectedTopic || undefined,
        subtopic_name: selectedSubtopic || undefined,
        language: 'en',
      };

      const result = await createAdminQuestion(payload);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create missing question.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            backgroundColor: '#1E293B',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
              }}
            >
              <Plus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#ffffff' }}>
                Add Missing Question #{questionNumber}
              </h3>
              <p style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', margin: '2px 0 0 0' }}>
                {exam.name || 'Exam Paper'} • Set {paperSetCode}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {errorMsg && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 8,
                  color: '#991B1B',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Sequence & Paper Set bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                  Question Number in Paper <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={questionNumber}
                  onChange={(e) => setQuestionNumber(parseInt(e.target.value) || 1)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                  required
                />
                {exam.missing_question_numbers && exam.missing_question_numbers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#64748B' }}>Missing Qs:</span>
                    {exam.missing_question_numbers.map((qNum) => (
                      <button
                        type="button"
                        key={qNum}
                        onClick={() => setQuestionNumber(qNum)}
                        style={{
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: questionNumber === qNum ? 700 : 500,
                          backgroundColor: questionNumber === qNum ? '#DC2626' : '#F1F5F9',
                          color: questionNumber === qNum ? '#ffffff' : '#475569',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        #{qNum}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                  Paper Set Code
                </label>
                <input
                  type="text"
                  value={paperSetCode}
                  onChange={(e) => setPaperSetCode(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 14,
                    backgroundColor: '#ffffff',
                  }}
                >
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                  Marks (+ / -)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    step="0.5"
                    value={marks}
                    onChange={(e) => setMarks(parseFloat(e.target.value) || 2.0)}
                    placeholder="Marks (+)"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(parseFloat(e.target.value) || 0.66)}
                    placeholder="Negative (-)"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Question Statement */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 6 }}>
                Question Statement / Text <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <textarea
                rows={4}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter complete question statement here (Markdown supported)..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                }}
                required
              />
            </div>

            {/* Passage Text (Optional) */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748B', marginBottom: 4 }}>
                Reading Comprehension Passage (Optional)
              </label>
              <textarea
                rows={2}
                value={passageText}
                onChange={(e) => setPassageText(e.target.value)}
                placeholder="If this question belongs to a passage..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>

            {/* Answer Options A, B, C, D */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>
                  Answer Options & Correct Key <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <span style={{ fontSize: 12, color: '#64748B' }}>Select the radio button for the correct option</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {options.map((opt, idx) => (
                  <div
                    key={opt.option_label}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: opt.is_correct ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                      backgroundColor: opt.is_correct ? '#F0FDF4' : '#F8FAFC',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleCorrectOptionChange(idx)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: opt.is_correct ? '#10B981' : '#E2E8F0',
                        color: opt.is_correct ? '#ffffff' : '#475569',
                        fontWeight: 700,
                        fontSize: 14,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                      title={opt.is_correct ? 'Correct Option' : 'Click to set as Correct Option'}
                    >
                      {opt.option_label}
                    </button>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input
                        type="text"
                        value={opt.option_text}
                        onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                        placeholder={`Option ${opt.option_label} Text`}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          fontSize: 13.5,
                          outline: 'none',
                        }}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Master Syllabus Hierarchy Selector */}
            <div style={{ padding: 16, borderRadius: 8, backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={16} color="#475569" />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#334155' }}>
                    Syllabus & Taxonomy Mapping
                  </span>
                </div>
                {taxonomyVerified !== null && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor: taxonomyVerified ? '#D1FAE5' : '#FEF3C7',
                      color: taxonomyVerified ? '#065F46' : '#92400E',
                    }}
                  >
                    {taxonomyVerified ? 'Canonical Verified' : 'Custom Topic'}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 4 }}>
                    Subject
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                  >
                    <option value="">Select Subject</option>
                    {syllabusTree.map((s, i) => {
                      const name = typeof s === 'string' ? s : s.name;
                      return (
                        <option key={i} value={name}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 4 }}>
                    Topic
                  </label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                  >
                    <option value="">Select Topic</option>
                    {availableTopics.map((t, i) => (
                      <option key={i} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 4 }}>
                    Subtopic
                  </label>
                  <select
                    value={selectedSubtopic}
                    onChange={(e) => setSelectedSubtopic(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                  >
                    <option value="">Select Subtopic</option>
                    {availableSubtopics.map((st, i) => (
                      <option key={i} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 4 Solution Parameters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', margin: '8px 0 0 0' }}>
                Solutions & Explanations
              </h4>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 4 }}>
                  Detailed Solution
                </label>
                <textarea
                  rows={3}
                  value={detailedSolution}
                  onChange={(e) => setDetailedSolution(e.target.value)}
                  placeholder="Detailed step-by-step solution..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>

              {/* Common Traps */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 4 }}>
                  Common Traps & Distractors
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={newTrap}
                    onChange={(e) => setNewTrap(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTrap())}
                    placeholder="Add common trap or misconception..."
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTrap}
                    style={{ padding: '7px 14px', borderRadius: 6, backgroundColor: '#475569', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {commonTraps.map((trap, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 16,
                        backgroundColor: '#FEF2F2',
                        color: '#991B1B',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {trap}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTrap(idx)} />
                    </span>
                  ))}
                </div>
              </div>

              {/* Key Takeaways */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#475569', marginBottom: 4 }}>
                  Key Takeaways
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={newTakeaway}
                    onChange={(e) => setNewTakeaway(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTakeaway())}
                    placeholder="Add key revision takeaway..."
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTakeaway}
                    style={{ padding: '7px 14px', borderRadius: 6, backgroundColor: '#475569', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {keyTakeaways.map((takeaway, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 16,
                        backgroundColor: '#EFF6FF',
                        color: '#1E40AF',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {takeaway}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTakeaway(idx)} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div
            style={{
              padding: '16px 24px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '9px 18px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontWeight: 500,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '9px 20px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: '#E31B23',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving Question...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  Save & Publish Question #{questionNumber}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
