import React, { useEffect, useState } from 'react';
import {
  Edit3,
  Save,
  X,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  FolderTree,
} from 'lucide-react';
import { AdminQuestionPublicationCard, AdminQuestionPublicationData } from './AdminQuestionPublicationCard';

export interface QuestionReviewOption {
  option_id?: string | number;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  distractor_analysis?: string | null;
  why_tempting?: string | null;
  whats_actually_true?: string | null;
}

export interface QuestionReviewHierarchyLink {
  subject_id?: string | number;
  subject_name?: string;
  topic_id?: string | number;
  topic_name?: string;
  subtopic_id?: string | number;
  subtopic_name?: string;
  is_primary?: boolean;
  relevance_percentage?: number;
  relevance_weight?: number;
  concept_name?: string;
}

export interface QuestionReviewData extends AdminQuestionPublicationData {
  id: string;
  status: string;
  negative_marks?: number;
  expected_time_seconds?: number;
  hierarchy?: QuestionReviewHierarchyLink[];
  explanation?: {
    detailed_solution?: string | null;
    common_traps?: string[];
    key_takeaways?: string[];
  } | null;
}

export interface QuestionReviewSavePayload {
  question_text: string;
  passage_text: string | null;
  difficulty: string;
  marks: number;
  negative_marks: number;
  expected_time_seconds: number;
  status: string;
  subject_name: string | null;
  topic_name: string | null;
  subtopic_name: string | null;
  hierarchy_links: QuestionReviewHierarchyLink[];
  detailed_solution: string;
  common_traps: string[];
  key_takeaways: string[];
  options: {
    option_id?: string | number;
    option_label: string;
    option_text: string;
    is_correct: boolean;
    display_order: number;
    distractor_analysis: string;
  }[];
}

interface EditableOption {
  option_id?: string | number;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  explanation: string; // used when this option is the correct answer
  why_tempting: string; // used when this option is incorrect
  whats_actually_true: string; // used when this option is incorrect
}

interface QuestionReviewCardProps {
  question: QuestionReviewData;
  isEditing: boolean;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (payload: QuestionReviewSavePayload, publishAfterSave: boolean) => void | Promise<void>;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13.5,
  borderRadius: 0,
  border: '1px solid #CBD5E1',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 4,
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E2E8F0',
  padding: '16px 18px',
  marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13.5,
  fontWeight: 700,
  color: '#172033',
  marginBottom: 12,
};

// The review-questions API serializes ids as strings, but the update endpoint's
// columns are integers — numbers must be sent back on save or the query fails.
function toNumericId(id: string | number | undefined): number | undefined {
  if (id === undefined || id === '') return undefined;
  const n = Number(id);
  return Number.isNaN(n) ? undefined : n;
}

function parseDistractor(opt: QuestionReviewOption): { why: string; actual: string } {
  const directWhy = (opt.why_tempting || '').trim();
  const directTrue = (opt.whats_actually_true || '').trim();
  if (directWhy || directTrue) return { why: directWhy, actual: directTrue };

  const raw = (opt.distractor_analysis || '').trim();
  if (!raw) return { why: '', actual: '' };

  const matchWhy = raw.match(
    /(?:Why\s+it\s+seems\s+tempting|Why\s+tempting)\s*[-–—:]\s*(.*?)(?=(?:What(?:'s|\s+is)\s+actually\s+true|What\s+is\s+true|Actually\s+true)\s*[-–—:]|$)/is
  );
  const matchTrue = raw.match(
    /(?:What(?:'s|\s+is)\s+actually\s+true|What\s+is\s+true|Actually\s+true)\s*[-–—:]\s*(.*)$/is
  );

  if (matchWhy || matchTrue) {
    return { why: matchWhy ? matchWhy[1].trim() : '', actual: matchTrue ? matchTrue[1].trim() : '' };
  }
  // Legacy free-text that doesn't match either pattern — keep it visible rather than dropping it.
  return { why: raw, actual: '' };
}

function TextChipList({
  items,
  onRemove,
  onAdd,
  placeholder,
  color,
}: {
  items: string[];
  onRemove: (idx: number) => void;
  onAdd: (value: string) => void;
  placeholder: string;
  color: { bg: string; border: string; text: string };
}) {
  const [draft, setDraft] = useState('');
  const submit = () => {
    if (draft.trim()) {
      onAdd(draft.trim());
      setDraft('');
    }
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={submit}
          style={{ padding: '8px 14px', fontSize: 12.5, fontWeight: 700, border: 'none', backgroundColor: color.text, color: '#FFFFFF', cursor: 'pointer' }}
        >
          Add
        </button>
      </div>
      {items.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                backgroundColor: color.bg,
                border: `1px solid ${color.border}`,
                fontSize: 12,
                color: color.text,
              }}
            >
              <span>{item}</span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 0, display: 'flex' }}
                title="Remove"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>None added yet.</div>
      )}
    </div>
  );
}

export function QuestionReviewCard({ question, isEditing, saving, onStartEdit, onCancelEdit, onSave }: QuestionReviewCardProps) {
  const [questionText, setQuestionText] = useState('');
  const [passageText, setPassageText] = useState('');
  const [showPassage, setShowPassage] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [topicName, setTopicName] = useState('');
  const [subtopicName, setSubtopicName] = useState('');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [marks, setMarks] = useState(2.0);
  const [negativeMarks, setNegativeMarks] = useState(0.66);
  const [expectedTime, setExpectedTime] = useState(60);
  const [detailedSolution, setDetailedSolution] = useState('');
  const [commonTraps, setCommonTraps] = useState<string[]>([]);
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [hierarchyLinks, setHierarchyLinks] = useState<QuestionReviewHierarchyLink[]>([]);
  const [showConceptLinks, setShowConceptLinks] = useState(false);
  const [options, setOptions] = useState<EditableOption[]>([]);

  useEffect(() => {
    if (!isEditing) return;

    setQuestionText(question.question_text || '');
    setPassageText(question.passage_text || '');
    setShowPassage(Boolean(question.passage_text && question.passage_text.trim().length > 0));
    setSubjectName(question.subject_name || '');
    setTopicName(question.topic_name || '');
    setSubtopicName(question.subtopic_name || '');
    setDifficulty(question.difficulty || 'MEDIUM');
    setMarks(question.marks ?? 2.0);
    setNegativeMarks(question.negative_marks ?? 0.66);
    setExpectedTime(question.expected_time_seconds ?? 60);
    setDetailedSolution(question.explanation?.detailed_solution || '');
    setCommonTraps(question.explanation?.common_traps ? [...question.explanation.common_traps] : []);
    setKeyTakeaways(question.explanation?.key_takeaways ? [...question.explanation.key_takeaways] : []);
    setShowConceptLinks(false);

    const rawH = question.hierarchy && question.hierarchy.length > 0 ? question.hierarchy : [];
    setHierarchyLinks(
      rawH.length > 0
        ? rawH.map((h) => ({
            ...h,
            subject_name: h.subject_name || question.subject_name || '',
            topic_name: h.topic_name || question.topic_name || '',
            subtopic_name: h.subtopic_name || question.subtopic_name || '',
            relevance_percentage: h.relevance_percentage ?? (h.relevance_weight ? Math.round(h.relevance_weight * 100) : 100),
          }))
        : [
            {
              subject_name: question.subject_name || '',
              topic_name: question.topic_name || '',
              subtopic_name: question.subtopic_name || '',
              is_primary: true,
              relevance_percentage: 100,
              concept_name: question.topic_name || '',
            },
          ]
    );

    const rawOpts: QuestionReviewOption[] =
      question.options && question.options.length > 0
        ? question.options
        : ['A', 'B', 'C', 'D'].map((label) => ({ option_label: label, option_text: '', is_correct: false }));

    setOptions(
      rawOpts.map((opt) => {
        const { why, actual } = parseDistractor(opt);
        return {
          option_id: opt.option_id,
          option_label: opt.option_label,
          option_text: opt.option_text || '',
          is_correct: Boolean(opt.is_correct),
          explanation: (opt.distractor_analysis || '').trim(),
          why_tempting: why,
          whats_actually_true: actual,
        };
      })
    );
  }, [isEditing, question]);

  if (!isEditing) {
    const commonTrapsList = question.explanation?.common_traps || [];
    const keyTakeawaysList = question.explanation?.key_takeaways || [];

    return (
      <div>
        <AdminQuestionPublicationCard question={question} questionNumber={question.question_number_in_paper} style={{ marginBottom: 16 }} />

        {(commonTrapsList.length > 0 || keyTakeawaysList.length > 0) && (
          <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#B45309', marginBottom: 8 }}>
              <AlertTriangle size={15} />
              Points to Remember
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>
              {commonTrapsList.map((trap, i) => (
                <li key={`trap-${i}`}>{trap}</li>
              ))}
              {keyTakeawaysList.map((tk, i) => (
                <li key={`takeaway-${i}`}>{tk}</li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            padding: '10px 14px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            fontSize: 12.5,
            color: '#475569',
          }}
        >
          <span>
            {question.subject_name || 'General Studies'}
            {question.topic_name ? ` › ${question.topic_name}` : ''}
            {question.subtopic_name ? ` › ${question.subtopic_name}` : ''}
            {'  ·  '}
            <strong>{question.difficulty}</strong>
            {'  ·  '}
            {question.marks} marks
          </span>
          <button
            type="button"
            onClick={onStartEdit}
            style={{
              padding: '6px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#172033',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Edit3 size={13} color="var(--primary-red)" />
            Edit Question
          </button>
        </div>
      </div>
    );
  }

  const setOption = (idx: number, patch: Partial<EditableOption>) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const buildPayload = (publishAfterSave: boolean): QuestionReviewSavePayload => {
    const primary = hierarchyLinks.find((h) => h.is_primary) || hierarchyLinks[0];
    const finalSubject = subjectName || primary?.subject_name || null;
    const finalTopic = topicName || primary?.topic_name || null;
    const finalSubtopic = subtopicName || primary?.subtopic_name || null;

    const syncedHierarchy: QuestionReviewHierarchyLink[] = hierarchyLinks.map((h, i) => {
      const isPrimary = Boolean(h.is_primary) || i === 0;
      return {
        subject_id: toNumericId(h.subject_id),
        subject_name: isPrimary ? finalSubject || undefined : h.subject_name || finalSubject || undefined,
        topic_id: toNumericId(h.topic_id),
        topic_name: isPrimary ? finalTopic || undefined : h.topic_name || finalTopic || undefined,
        subtopic_id: toNumericId(h.subtopic_id),
        subtopic_name: isPrimary ? finalSubtopic || undefined : h.subtopic_name || finalSubtopic || undefined,
        is_primary: isPrimary,
        relevance_weight: (h.relevance_percentage ?? 100) / 100,
        concept_name: h.concept_name || (isPrimary ? finalTopic || undefined : undefined),
      };
    });

    return {
      question_text: questionText,
      passage_text: passageText || null,
      difficulty,
      marks,
      negative_marks: negativeMarks,
      expected_time_seconds: expectedTime,
      status: publishAfterSave ? 'PUBLISHED' : question.status,
      subject_name: finalSubject,
      topic_name: finalTopic,
      subtopic_name: finalSubtopic,
      hierarchy_links: syncedHierarchy,
      detailed_solution: detailedSolution,
      common_traps: commonTraps,
      key_takeaways: keyTakeaways,
      options: options.map((opt, idx) => {
        let distractor_analysis = '';
        if (opt.is_correct) {
          distractor_analysis = opt.explanation.trim();
        } else {
          const why = opt.why_tempting.trim();
          const actual = opt.whats_actually_true.trim();
          if (why && actual) distractor_analysis = `Why it seems tempting — ${why}. What's actually true — ${actual}`;
          else if (why) distractor_analysis = `Why it seems tempting — ${why}`;
          else if (actual) distractor_analysis = `What's actually true — ${actual}`;
        }
        return {
          option_id: toNumericId(opt.option_id),
          option_label: opt.option_label,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
          display_order: idx + 1,
          distractor_analysis,
        };
      }),
    };
  };

  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Question Text</label>
          <button
            type="button"
            onClick={() => setShowPassage((v) => !v)}
            style={{ fontSize: 11.5, fontWeight: 600, color: showPassage ? '#DC2626' : '#2563EB', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {showPassage ? '− Remove reading passage' : '+ Add reading passage'}
          </button>
        </div>
        {showPassage && (
          <textarea
            rows={3}
            value={passageText}
            onChange={(e) => setPassageText(e.target.value)}
            placeholder="Reading passage / reference context (if applicable)..."
            style={{ ...inputStyle, marginBottom: 10, backgroundColor: '#F8FAFC' }}
          />
        )}
        <textarea
          rows={4}
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Enter the full question statement..."
          style={inputStyle}
        />
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Options</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {options.map((opt, idx) => (
            <div
              key={opt.option_label || idx}
              style={{
                padding: 14,
                backgroundColor: opt.is_correct ? '#F0FDF4' : '#FFFFFF',
                border: opt.is_correct ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: opt.is_correct ? '#16A34A' : '#475569',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {opt.option_label}
                </div>
                <input
                  type="text"
                  value={opt.option_text}
                  onChange={(e) => setOption(idx, { option_text: e.target.value })}
                  placeholder={`Option ${opt.option_label} text...`}
                  style={{ ...inputStyle, flex: 1, minWidth: 180, borderColor: opt.is_correct ? '#86EFAC' : '#CBD5E1' }}
                />
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: opt.is_correct ? '#15803D' : '#64748B',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    backgroundColor: opt.is_correct ? '#DCFCE7' : '#F1F5F9',
                    border: `1px solid ${opt.is_correct ? '#86EFAC' : '#E2E8F0'}`,
                    flexShrink: 0,
                  }}
                >
                  {opt.is_correct ? '✓ Correct Answer' : 'Mark as Correct'}
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                {opt.is_correct ? (
                  <div>
                    <label style={labelStyle}>Why this is correct</label>
                    <textarea
                      rows={2}
                      value={opt.explanation}
                      onChange={(e) => setOption(idx, { explanation: e.target.value })}
                      placeholder="Explain why this option is the correct answer..."
                      style={inputStyle}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>
                        <Lightbulb size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
                        Why it seems tempting
                      </label>
                      <textarea
                        rows={2}
                        value={opt.why_tempting}
                        onChange={(e) => setOption(idx, { why_tempting: e.target.value })}
                        placeholder="Why a student might pick this option..."
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>What's actually true</label>
                      <textarea
                        rows={2}
                        value={opt.whats_actually_true}
                        onChange={(e) => setOption(idx, { whats_actually_true: e.target.value })}
                        placeholder="Why it's actually wrong..."
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Detailed Solution</div>
        <textarea
          rows={6}
          value={detailedSolution}
          onChange={(e) => setDetailedSolution(e.target.value)}
          placeholder="Step-by-step comprehensive solution..."
          style={inputStyle}
        />
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Common Traps</div>
        <TextChipList
          items={commonTraps}
          onAdd={(v) => setCommonTraps((prev) => [...prev, v])}
          onRemove={(idx) => setCommonTraps((prev) => prev.filter((_, i) => i !== idx))}
          placeholder="Add a common trap or memory tip... (Enter to add)"
          color={{ bg: '#FEF3C7', border: '#FDE68A', text: '#B45309' }}
        />
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Key Takeaways</div>
        <TextChipList
          items={keyTakeaways}
          onAdd={(v) => setKeyTakeaways((prev) => [...prev, v])}
          onRemove={(idx) => setKeyTakeaways((prev) => prev.filter((_, i) => i !== idx))}
          placeholder="Add a key takeaway... (Enter to add)"
          color={{ bg: '#DBEAFE', border: '#BFDBFE', text: '#1D4ED8' }}
        />
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Classification</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Subject</label>
            <input type="text" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Topic</label>
            <input type="text" value={topicName} onChange={(e) => setTopicName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Subtopic</label>
            <input type="text" value={subtopicName} onChange={(e) => setSubtopicName(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div>
            <label style={labelStyle}>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}>
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Marks</label>
            <input type="number" step="0.5" value={marks} onChange={(e) => setMarks(parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Negative Marks</label>
            <input type="number" step="0.01" value={negativeMarks} onChange={(e) => setNegativeMarks(parseFloat(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Expected Time (s)</label>
            <input type="number" value={expectedTime} onChange={(e) => setExpectedTime(parseInt(e.target.value, 10) || 0)} style={inputStyle} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowConceptLinks((v) => !v)}
          style={{
            marginTop: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: '#475569',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <FolderTree size={13} />
          Additional concept links ({hierarchyLinks.length})
          {showConceptLinks ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showConceptLinks && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hierarchyLinks.map((h, idx) => {
              const pct = h.relevance_percentage ?? 100;
              return (
                <div key={idx} style={{ border: '1px solid #E2E8F0', padding: 10, backgroundColor: '#F8FAFC' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={h.subject_name || ''}
                      onChange={(e) => setHierarchyLinks((prev) => prev.map((item, i) => (i === idx ? { ...item, subject_name: e.target.value } : item)))}
                      placeholder="Subject"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={h.topic_name || ''}
                      onChange={(e) => setHierarchyLinks((prev) => prev.map((item, i) => (i === idx ? { ...item, topic_name: e.target.value } : item)))}
                      placeholder="Topic"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={h.subtopic_name || ''}
                      onChange={(e) => setHierarchyLinks((prev) => prev.map((item, i) => (i === idx ? { ...item, subtopic_name: e.target.value } : item)))}
                      placeholder="Subtopic"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={pct}
                      onChange={(e) =>
                        setHierarchyLinks((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, relevance_percentage: parseInt(e.target.value, 10) || 0 } : item))
                        )
                      }
                      placeholder="Relevance %"
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#64748B' }}>
                      <input
                        type="radio"
                        name="primary-concept"
                        checked={Boolean(h.is_primary)}
                        onChange={() => setHierarchyLinks((prev) => prev.map((item, i) => ({ ...item, is_primary: i === idx })))}
                      />
                      Primary
                    </label>
                    {hierarchyLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setHierarchyLinks((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', padding: 2 }}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setHierarchyLinks((prev) => [
                  ...prev,
                  { subject_name: subjectName, topic_name: '', subtopic_name: '', is_primary: false, relevance_percentage: 75, concept_name: '' },
                ])
              }
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#2563EB',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Add Concept Link
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={saving}
          style={{ padding: '9px 16px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(buildPayload(false), false)}
          disabled={saving}
          style={{ padding: '9px 16px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#172033', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={() => onSave(buildPayload(true), true)}
          disabled={saving}
          style={{
            padding: '9px 18px',
            border: 'none',
            backgroundColor: '#16A34A',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save & Mark Verified
        </button>
      </div>
    </div>
  );
}
