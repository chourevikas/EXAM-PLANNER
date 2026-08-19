import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bookmark, Eye, CheckCircle2, XCircle, Menu } from 'lucide-react';
import { QuestionOut, RevealAnswerResponse } from '../../types/exam';

interface ExamQuestionCardProps {
  question: QuestionOut | {
    id: number | string;
    sectionId?: string;
    sectionName?: string;
    subtopic_name?: string;
    topic_name?: string;
    difficulty?: string;
    text: string;
    textHindi?: string;
    text_hindi?: string;
    question_text_hi?: string;
    question_text_hindi?: string;
    translations?: Record<string, any>;
    passage_text?: string | null;
    passage_text_hindi?: string | null;
    passage_translations?: Record<string, string>;
    options: {
      label: string;
      text: string;
      textHindi?: string;
      text_hindi?: string;
      option_id?: string;
      translations?: Record<string, any>;
    }[];
  };
  questionIndex: number;
  totalQuestions: number;
  selectedOptionId?: string | null;
  selectedOptionLabel?: string | null;
  isBookmarked: boolean;
  language: 'en' | 'hi';
  mode?: 'EXAM' | 'PRACTICE' | 'REVISION';
  revealResult?: RevealAnswerResponse | null;
  isRevealing?: boolean;
  onSelectOption: (optionId: string, optionLabel: string) => void;
  onToggleBookmark: () => void;
  onRevealAnswer?: () => void;
  onToggleSidebar?: () => void;
}

function cleanQuestionTextBody(rawText: string): string {
  if (!rawText) return '';
  let text = String(rawText).trim();
  text = text.replace(/^\[[^\]]+\]\s*Question\s*#\d+\:\s*/i, '');
  text = text.replace(/^Question\s*#\d+\:\s*/i, '');
  return text.trim();
}

function getQuestionText(q: any, lang: 'en' | 'hi'): string {
  let raw = '';
  if (lang === 'hi') {
    if (q.textHindi) raw = q.textHindi;
    else if (q.text_hindi) raw = q.text_hindi;
    else if (q.question_text_hindi) raw = q.question_text_hindi;
    else if (q.question_text_hi) raw = q.question_text_hi;
    else if (q.translations) {
      if (typeof q.translations.hi === 'string') raw = q.translations.hi;
      else if (q.translations.hi?.text) raw = q.translations.hi.text;
      else if (q.translations.hi?.question_text) raw = q.translations.hi.question_text;
    }
  }
  if (!raw) {
    raw = q.text || q.question_text || '';
  }
  return cleanQuestionTextBody(raw);
}

function getPassageText(q: any, lang: 'en' | 'hi'): string | null {
  if (lang === 'hi') {
    if (q.passage_text_hindi) return q.passage_text_hindi;
    if (q.passage_text_hi) return q.passage_text_hi;
    if (q.passageTextHindi) return q.passageTextHindi;
  }
  return q.passage_text || null;
}

function cleanOptionLabel(rawLabel: string, index: number): string {
  if (!rawLabel) return String.fromCharCode(65 + index);
  const clean = String(rawLabel).replace(/[\(\)\.\s]/g, '').toUpperCase();
  return clean.length === 1 ? clean : String.fromCharCode(65 + index);
}

function cleanOptionText(rawText: string): string {
  if (!rawText) return '';
  let text = String(rawText).trim();
  text = text.replace(/^[\(\[]+([a-dA-D1-4])[\)\]]+\s*/, '');
  text = text.replace(/^([a-dA-D1-4])[\)\.\:]\s*/, '');
  return text.trim();
}

function getOptionText(opt: any, lang: 'en' | 'hi', optIdx?: number, q?: any): string {
  let rawText = opt.text || opt.option_text;
  if (lang === 'hi') {
    if (opt.textHindi) rawText = opt.textHindi;
    else if (opt.text_hindi) rawText = opt.text_hindi;
    else if (opt.option_text_hindi) rawText = opt.option_text_hindi;
  }
  if (!rawText) {
    rawText = `Option ${String.fromCharCode(65 + (optIdx || 0))}`;
  }
  return cleanOptionText(rawText);
}

export function ExamQuestionCard({
  question,
  questionIndex,
  totalQuestions,
  selectedOptionId,
  selectedOptionLabel,
  isBookmarked,
  language,
  mode = 'EXAM',
  revealResult,
  isRevealing = false,
  onSelectOption,
  onToggleBookmark,
  onRevealAnswer,
  onToggleSidebar,
}: ExamQuestionCardProps) {
  const sectionLabel =
    ('subject' in question && (question as any).subject) ||
    ('topic_name' in question && (question as any).topic_name) ||
    ('section_code' in question ? question.section_code : (question as any).sectionName) ||
    'INDIAN POLITY & GOVERNANCE';

  const subtopicLabel =
    ('subtopic_name' in question && (question as any).subtopic_name) ||
    ('subtopic' in question && (question as any).subtopic) ||
    '';

  const difficultyLabel = String(question.difficulty || 'MEDIUM').toUpperCase();

  const passageContent = getPassageText(question, language);
  const questionContent = getQuestionText(question, language);

  const options = question.options.map((opt: any, optIdx: number) => {
    const rawLabel = opt.option_label || opt.label;
    const cleanLbl = cleanOptionLabel(rawLabel, optIdx);
    return {
      id: opt.option_id || opt.id || cleanLbl,
      rawLabel,
      cleanLabel: cleanLbl,
      text: getOptionText(opt, language, optIdx, question),
    };
  });

  const questionMarkdownComponents: any = {
    p: ({ node, ...props }: any) => (
      <p style={{ margin: '10px 0', lineHeight: 1.68, fontSize: 20.5, fontWeight: 500, color: '#142033' }} {...props} />
    ),
    strong: ({ node, ...props }: any) => <strong style={{ fontWeight: 700, color: '#142033' }} {...props} />,
    table: ({ node, ...props }: any) => (
      <div style={{ overflowX: 'auto', margin: '16px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 15,
            border: '1px solid #E2E6EC',
            borderRadius: 6,
          }}
          {...props}
        />
      </div>
    ),
    th: ({ node, ...props }: any) => (
      <th
        style={{
          padding: '10px 14px',
          fontWeight: 700,
          textAlign: 'left',
          backgroundColor: '#F1F5F9',
          borderBottom: '2px solid #E2E6EC',
          color: '#142033',
        }}
        {...props}
      />
    ),
    td: ({ node, ...props }: any) => (
      <td
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #F1F5F9',
          color: '#142033',
        }}
        {...props}
      />
    ),
    ul: ({ node, ...props }: any) => <ul style={{ paddingLeft: 22, margin: '10px 0' }} {...props} />,
    ol: ({ node, ...props }: any) => <ol style={{ paddingLeft: 22, margin: '10px 0' }} {...props} />,
    li: ({ node, ...props }: any) => <li style={{ margin: '6px 0', fontSize: 19.5, color: '#142033', lineHeight: 1.62 }} {...props} />,
  };

  const optionMarkdownComponents: any = {
    p: ({ node, ...props }: any) => <span style={{ display: 'inline', margin: 0 }} {...props} />,
    strong: ({ node, ...props }: any) => <strong style={{ fontWeight: 700 }} {...props} />,
  };

  return (
    <main
      style={{
        flex: 1,
        padding: '24px 32px',
        overflowY: 'auto',
        boxSizing: 'border-box',
        backgroundColor: '#F4F6F8',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          maxWidth: 840,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          flex: 1,
        }}
      >
        {/* Reading Passage (If Present) */}
        {passageContent && (
          <div
            style={{
              backgroundColor: '#FAFBFC',
              padding: '20px 24px',
              borderRadius: 10,
              border: '1px solid #E2E6EC',
              borderLeft: '4px solid #2563EB',
              fontSize: 15.5,
              color: '#334155',
              lineHeight: 1.62,
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={questionMarkdownComponents}>
              {passageContent}
            </ReactMarkdown>
          </div>
        )}

        {/* Primary Continuous Examination Canvas Card */}
        <div
          style={{
            backgroundColor: '#FAFBFC',
            border: '1px solid #E2E6EC',
            borderTop: '3px solid #2563EB',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}
        >
          {/* UPSC Exam Header Metadata Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 22,
              paddingBottom: 14,
              borderBottom: '1px solid #E2E6EC',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Sections Trigger Button */}
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#142033',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease-out',
                    marginRight: 4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#EFF6FF';
                    e.currentTarget.style.borderColor = '#2563EB';
                    e.currentTarget.style.color = '#2563EB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.color = '#142033';
                  }}
                  title="Open Sections Drawer"
                >
                  <Menu size={14} />
                  <span>Sections</span>
                </button>
              )}

              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#142033', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
                QUESTION {String(questionIndex + 1).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ fontSize: 12.5, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {sectionLabel} {subtopicLabel ? `· ${subtopicLabel}` : ''}
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ fontSize: 11.5, color: '#D97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#D97706', display: 'inline-block' }} />
                {difficultyLabel}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Practice Mode Only: Reveal Solution */}
              {mode !== 'EXAM' && onRevealAnswer && (
                <button
                  type="button"
                  onClick={onRevealAnswer}
                  disabled={isRevealing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #DBEAFE',
                    borderRadius: 6,
                    padding: '5px 12px',
                    cursor: isRevealing ? 'wait' : 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 0.18s ease-out',
                  }}
                  onMouseEnter={(e) => {
                    if (!isRevealing) e.currentTarget.style.backgroundColor = '#DBEAFE';
                  }}
                  onMouseLeave={(e) => {
                    if (!isRevealing) e.currentTarget.style.backgroundColor = '#EFF6FF';
                  }}
                >
                  <Eye size={13} />
                  <span>{revealResult ? 'Answer Revealed' : isRevealing ? 'Revealing...' : 'Reveal Solution'}</span>
                </button>
              )}

              {/* Bookmark Button */}
              <button
                type="button"
                onClick={onToggleBookmark}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 8px',
                  color: isBookmarked ? '#D97706' : '#64748B',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 600,
                  transition: 'all 0.18s ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F1F5F9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Bookmark size={15} fill={isBookmarked ? '#D97706' : 'none'} />
                <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
              </button>
            </div>
          </div>

          {/* Question Body */}
          <div style={{ marginBottom: 28, fontSize: 20.5, color: '#142033', fontWeight: 500, lineHeight: 1.68 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={questionMarkdownComponents}>
              {questionContent}
            </ReactMarkdown>
          </div>

          {/* Answer Choice Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
            {options.map((opt) => {
              const isSelected = selectedOptionId === opt.id || selectedOptionLabel === opt.cleanLabel || selectedOptionLabel === opt.rawLabel;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectOption(opt.id, opt.cleanLabel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 20px',
                    borderRadius: 10,
                    border: isSelected ? '1px solid #93C5FD' : '1px solid #E2E6EC',
                    borderLeft: isSelected ? '4px solid #2563EB' : '1px solid #E2E6EC',
                    backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                    color: '#142033',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.18s ease-out',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                      e.currentTarget.style.borderColor = '#CBD5E1';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 3px 10px rgba(15,23,42,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                      e.currentTarget.style.borderColor = '#E2E6EC';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {/* Option Label Badge ([A], [B], [C], [D]) */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      backgroundColor: isSelected ? '#2563EB' : '#F1F5F9',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      fontWeight: 700,
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.18s ease-out',
                    }}
                  >
                    {opt.cleanLabel}
                  </div>

                  {/* Option Text */}
                  <div style={{ fontSize: 16, color: '#142033', fontWeight: 400, lineHeight: 1.5, flex: 1 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={optionMarkdownComponents}>
                      {opt.text}
                    </ReactMarkdown>
                  </div>

                  {/* Right Selection Radio Circle */}
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: isSelected ? '5px solid #2563EB' : '1.5px solid #CBD5E1',
                      backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                      transition: 'all 0.18s ease-out',
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Reveal Result Box (Practice / Revision Mode) */}
          {mode !== 'EXAM' && revealResult && (
            <div
              style={{
                marginTop: 22,
                padding: '14px 18px',
                borderRadius: 8,
                backgroundColor: revealResult.is_user_correct ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${revealResult.is_user_correct ? '#A7F3D0' : '#FECACA'}`,
                color: '#142033',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                {revealResult.is_user_correct ? (
                  <>
                    <CheckCircle2 size={16} style={{ color: '#059669' }} />
                    <span style={{ color: '#059669' }}>Correct Answer</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} style={{ color: '#DC2626' }} />
                    <span style={{ color: '#DC2626' }}>Incorrect Answer</span>
                  </>
                )}
              </div>
              {revealResult.explanation && (
                <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55 }}>
                  <strong style={{ color: '#142033' }}>Explanation:</strong>{' '}
                  {typeof revealResult.explanation === 'string'
                    ? revealResult.explanation
                    : JSON.stringify(revealResult.explanation)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
