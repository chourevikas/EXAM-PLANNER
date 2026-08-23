import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, CheckCircle2, XCircle, Menu } from 'lucide-react';
import { QuestionOut, RevealAnswerResponse } from '../../types/exam';
import { QuestionSolutionMarkdownCard } from './QuestionSolutionMarkdownCard';

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
  isBookmarked?: boolean;
  language: 'en' | 'hi';
  mode?: 'EXAM' | 'PRACTICE' | 'REVISION';
  revealResult?: RevealAnswerResponse | null;
  isRevealing?: boolean;
  onSelectOption: (optionId: string, optionLabel: string) => void;
  onToggleBookmark?: () => void;
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
      <p
        style={{
          margin: '8px 0',
          lineHeight: 1.55,
          fontSize: 17.5,
          fontWeight: 600,
          color: '#0F172A',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        {...props}
      />
    ),
    strong: ({ node, ...props }: any) => <strong style={{ fontWeight: 700, color: '#0F172A' }} {...props} />,
    table: ({ node, ...props }: any) => (
      <div style={{ overflowX: 'auto', margin: '12px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13.5,
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
          {...props}
        />
      </div>
    ),
    th: ({ node, ...props }: any) => (
      <th
        style={{
          padding: '8px 12px',
          fontWeight: 700,
          textAlign: 'left',
          backgroundColor: '#F1F5F9',
          borderBottom: '2px solid #E2E8F0',
          color: '#0F172A',
        }}
        {...props}
      />
    ),
    td: ({ node, ...props }: any) => (
      <td
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #F1F5F9',
          color: '#0F172A',
        }}
        {...props}
      />
    ),
    ul: ({ node, ...props }: any) => <ul style={{ paddingLeft: 20, margin: '8px 0' }} {...props} />,
    ol: ({ node, ...props }: any) => <ol style={{ paddingLeft: 20, margin: '8px 0' }} {...props} />,
    li: ({ node, ...props }: any) => (
      <li
        style={{
          margin: '4px 0',
          fontSize: 16.5,
          color: '#0F172A',
          lineHeight: 1.5,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        {...props}
      />
    ),
  };

  const optionMarkdownComponents: any = {
    p: ({ node, ...props }: any) => (
      <span style={{ display: 'inline', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }} {...props} />
    ),
    strong: ({ node, ...props }: any) => <strong style={{ fontWeight: 700 }} {...props} />,
  };

  return (
    <main
      style={{
        flex: 1,
        padding: '24px 24px 60px 24px',
        overflowY: 'auto',
        boxSizing: 'border-box',
        backgroundColor: '#F4F6F8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 800,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          paddingBottom: 40,
        }}
      >
        {/* Reading Passage (If Present) */}
        {passageContent && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              padding: '16px 20px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              borderLeft: '4px solid #2563EB',
              fontSize: 15,
              color: '#334155',
              lineHeight: 1.55,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={questionMarkdownComponents}>
              {passageContent}
            </ReactMarkdown>
          </div>
        )}

        {/* Compact Examination Canvas Card with Internal Scrollbar */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderTop: '3px solid #2563EB',
            borderRadius: 10,
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 170px)',
            boxSizing: 'border-box',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {/* UPSC Exam Header Metadata Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              marginBottom: 20,
              paddingBottom: 14,
              borderBottom: '1.5px solid #F1F5F9',
              flexShrink: 0,
            }}
          >
            {/* Left: Sections Drawer Trigger */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 7,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    color: '#0F172A',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease-out',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#EFF6FF';
                    e.currentTarget.style.borderColor = '#2563EB';
                    e.currentTarget.style.color = '#2563EB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.color = '#0F172A';
                  }}
                  title="Open Sections Drawer"
                >
                  <Menu size={14} />
                  <span>Sections</span>
                </button>
              )}
            </div>

            {/* Center: Question Counter Pill */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#0F172A',
                  letterSpacing: '0.04em',
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  backgroundColor: '#F1F5F9',
                  padding: '5px 14px',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                }}
              >
                QUESTION {String(questionIndex + 1).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
              </span>
            </div>

            {/* Right: Difficulty Badge */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11.5,
                  color: '#D97706',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                  padding: '4px 12px',
                  borderRadius: 99,
                  letterSpacing: '0.04em',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#D97706', display: 'inline-block' }} />
                {difficultyLabel}
              </span>
            </div>
          </div>

          {/* Internally Scrollable Question Content Body */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              paddingRight: 6,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Question Body (Compact 17.5px font, 600 weight) */}
            <div
              style={{
                marginBottom: 16,
                fontSize: 17.5,
                color: '#0F172A',
                fontWeight: 600,
                lineHeight: 1.55,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={questionMarkdownComponents}>
                {questionContent}
              </ReactMarkdown>
            </div>

          {/* Answer Choice Cards (Compact 14.5px font, 10px 14px padding) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
            {options.map((opt) => {
              const isSelected = selectedOptionId === opt.id || selectedOptionLabel === opt.cleanLabel || selectedOptionLabel === opt.rawLabel;
              
              const isCorrectOpt = revealResult && (revealResult.correct_option_id === opt.id || revealResult.correct_option_label === opt.cleanLabel);
              const isWrongSelectedOpt = revealResult && isSelected && !isCorrectOpt;

              let borderStyle = isSelected ? '1.5px solid #2563EB' : '1px solid #E2E8F0';
              let bgStyle = isSelected ? '#EFF6FF' : '#F8FAFC';
              let badgeBg = isSelected ? '#2563EB' : '#FFFFFF';
              let badgeColor = isSelected ? '#FFFFFF' : '#475569';
              let badgeBorder = isSelected ? '1px solid #2563EB' : '1px solid #CBD5E1';

              if (revealResult) {
                if (isCorrectOpt) {
                  borderStyle = '1.5px solid #10B981';
                  bgStyle = '#ECFDF5';
                  badgeBg = '#10B981';
                  badgeColor = '#FFFFFF';
                  badgeBorder = '1px solid #10B981';
                } else if (isWrongSelectedOpt) {
                  borderStyle = '1.5px solid #EF4444';
                  bgStyle = '#FEF2F2';
                  badgeBg = '#EF4444';
                  badgeColor = '#FFFFFF';
                  badgeBorder = '1px solid #EF4444';
                }
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectOption(opt.id, opt.cleanLabel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: borderStyle,
                    backgroundColor: bgStyle,
                    color: '#0F172A',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.18s ease-out',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {/* Option Label Badge ([A], [B], [C], [D]) */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: badgeBg,
                      color: badgeColor,
                      border: badgeBorder,
                      fontWeight: 700,
                      fontSize: 12.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.18s ease-out',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    {opt.cleanLabel}
                  </div>

                  {/* Option Text */}
                  <div
                    style={{
                      fontSize: 14.5,
                      color: '#0F172A',
                      fontWeight: (isSelected || isCorrectOpt) ? 600 : 500,
                      lineHeight: 1.45,
                      flex: 1,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={optionMarkdownComponents}>
                      {opt.text}
                    </ReactMarkdown>
                  </div>

                  {/* Right Status Indicator */}
                  {isCorrectOpt ? (
                    <CheckCircle2 size={18} style={{ color: '#10B981', flexShrink: 0 }} />
                  ) : isWrongSelectedOpt ? (
                    <XCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                  ) : (
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: isSelected ? '4.5px solid #2563EB' : '1.5px solid #CBD5E1',
                        backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        transition: 'all 0.18s ease-out',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Rich Solution Markdown Card (Practice / Revision Mode) */}
          {mode !== 'EXAM' && revealResult && (
            <QuestionSolutionMarkdownCard
              isUserCorrect={revealResult.is_user_correct}
              selectedOptionLabel={revealResult.user_selected_label || selectedOptionLabel || undefined}
              solution={{
                question_id: revealResult.question_id,
                question_number: revealResult.question_number || questionIndex + 1,
                correct_option_id: revealResult.correct_option_id,
                correct_option_label: revealResult.correct_option_label,
                blooms_level: (question as any).blooms_taxonomy_level || (question as any).blooms_level || 'ANALYZE',
                difficulty: (question as any).difficulty || 'MEDIUM',
                topic: (question as any).topic_name || (question as any).topic || (question as any).section_code,
                subtopic: (question as any).subtopic_name || (question as any).subtopic,
                presigned_url: (revealResult as any).presigned_url,
                explanation: typeof revealResult.explanation === 'object' && revealResult.explanation !== null
                  ? {
                      core_concept: (revealResult.explanation as any).core_concept,
                      detailed_solution: (revealResult.explanation as any).detailed_solution || (revealResult.explanation as any).detailed_text || (revealResult.explanation as any).text || (typeof revealResult.explanation === 'string' ? revealResult.explanation : ''),
                      common_traps: (revealResult.explanation as any).common_traps || (revealResult.explanation as any).traps || [],
                      key_takeaways: (revealResult.explanation as any).key_takeaways || (revealResult.explanation as any).points_to_remember || ((revealResult.explanation as any).key_takeaway ? [(revealResult.explanation as any).key_takeaway] : []),
                    }
                  : {
                      detailed_solution: typeof revealResult.explanation === 'string' ? revealResult.explanation : 'Detailed solution is available.',
                    },
                distractor_scores: revealResult.distractor_scores || {},
              }}
            />
          )}
          </div>
        </div>
      </div>
    </main>
  );
}
