import React from 'react';
import { Bookmark, Eye, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { OptionOut, QuestionOut, RevealAnswerResponse } from '../../types/exam';

interface ExamQuestionCardProps {
  question: QuestionOut | {
    id: number | string;
    sectionId?: string;
    sectionName?: string;
    difficulty?: string;
    text: string;
    textHindi?: string;
    passage_text?: string | null;
    options: { label: string; text: string; textHindi?: string; option_id?: string }[];
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
}: ExamQuestionCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const sectionLabel = ('section_code' in question ? question.section_code : (question as any).sectionName) || 'General';
  const difficultyLabel = question.difficulty || 'MEDIUM';

  const options: Array<{ id: string; label: string; text: string; textHindi?: string }> = question.options.map((opt: any) => ({
    id: opt.option_id || opt.id || opt.label,
    label: opt.option_label || opt.label,
    text: opt.text,
    textHindi: opt.textHindi,
  }));

  return (
    <main
      style={{
        flex: 1,
        padding: 24,
        overflowY: 'auto',
        boxSizing: 'border-box',
        backgroundColor: isDark ? '#0b1329' : '#f8fafc',
        transition: 'background-color 0.2s',
      }}
    >
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Question Header Metadata Pill */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isDark ? '#131f37' : '#ffffff',
            padding: '12px 20px',
            borderRadius: 14,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
            boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#2563eb', fontFamily: 'var(--font-display)' }}>
              Question {questionIndex + 1} of {totalQuestions}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 12,
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                color: '#2563eb',
                fontWeight: 700,
              }}
            >
              {sectionLabel}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 12,
                backgroundColor:
                  difficultyLabel === 'EASY' || difficultyLabel === 'Easy'
                    ? isDark
                      ? 'rgba(16, 185, 129, 0.15)'
                      : '#ecfdf5'
                    : difficultyLabel === 'MEDIUM' || difficultyLabel === 'Medium'
                    ? isDark
                      ? 'rgba(245, 158, 11, 0.15)'
                      : '#fffbe0'
                    : isDark
                    ? 'rgba(239, 68, 68, 0.15)'
                    : '#fef2f2',
                color:
                  difficultyLabel === 'EASY' || difficultyLabel === 'Easy'
                    ? '#10b981'
                    : difficultyLabel === 'MEDIUM' || difficultyLabel === 'Medium'
                    ? '#d97706'
                    : '#ef4444',
                fontWeight: 700,
              }}
            >
              {difficultyLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {mode !== 'EXAM' && onRevealAnswer && (
              <button
                onClick={onRevealAnswer}
                disabled={isRevealing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: '#2563eb',
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  borderRadius: 10,
                  padding: '6px 14px',
                  cursor: isRevealing ? 'wait' : 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <Eye size={14} />
                <span>{revealResult ? 'Answer Revealed' : isRevealing ? 'Revealing...' : 'Reveal Solution'}</span>
              </button>
            )}

            <button
              onClick={onToggleBookmark}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: isBookmarked ? '#f59e0b' : isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Bookmark size={16} fill={isBookmarked ? '#f59e0b' : 'none'} />
              <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
            </button>
          </div>
        </div>

        {/* Passage Text (If Reading Comprehension / Passage Item) */}
        {question.passage_text && (
          <div
            style={{
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9',
              padding: 20,
              borderRadius: 14,
              borderLeft: '4px solid #2563eb',
              fontSize: 14,
              lineHeight: 1.6,
              color: isDark ? '#cbd5e1' : '#334155',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#2563eb', marginBottom: 6 }}>
              Reading Passage
            </div>
            {question.passage_text}
          </div>
        )}

        {/* Question Text Box */}
        <div
          style={{
            backgroundColor: isDark ? '#131f37' : '#ffffff',
            padding: 24,
            borderRadius: 16,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
            fontSize: 16,
            lineHeight: 1.65,
            fontWeight: 500,
            color: isDark ? '#ffffff' : '#0f172a',
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.03)',
            whiteSpace: 'pre-line',
          }}
        >
          {language === 'hi' && (question as any).textHindi ? (question as any).textHindi : question.text}
        </div>

        {/* Options Selection Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {options.map((opt) => {
            const isSelected = selectedOptionId === opt.id || selectedOptionLabel === opt.label;
            const isCorrectOption = revealResult && (revealResult.correct_option_id === opt.id || revealResult.correct_option_label === opt.label);

            let borderColor = isSelected
              ? '#2563eb'
              : isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : '#e2e8f0';
            let bgColor = isSelected
              ? isDark
                ? 'rgba(37, 99, 235, 0.15)'
                : '#eff6ff'
              : isDark
              ? '#131f37'
              : '#ffffff';

            if (revealResult) {
              if (isCorrectOption) {
                borderColor = '#10b981';
                bgColor = isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5';
              } else if (isSelected && !revealResult.is_user_correct) {
                borderColor = '#ef4444';
                bgColor = isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2';
              }
            }

            return (
              <button
                key={opt.id}
                onClick={() => onSelectOption(opt.id, opt.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 20px',
                  borderRadius: 14,
                  border: `2px solid ${borderColor}`,
                  backgroundColor: bgColor,
                  color: isDark ? '#ffffff' : '#0f172a',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected
                    ? '0 4px 16px rgba(37, 99, 235, 0.18)'
                    : isDark
                    ? 'none'
                    : '0 1px 3px rgba(0,0,0,0.02)',
                }}
              >
                {/* Option Badge Circle */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: isCorrectOption
                      ? '#10b981'
                      : isSelected && revealResult && !revealResult.is_user_correct
                      ? '#ef4444'
                      : isSelected
                      ? '#2563eb'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#f1f5f9',
                    color: isSelected || isCorrectOption ? '#ffffff' : isDark ? '#ffffff' : '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {opt.label}
                </div>

                {/* Option Text */}
                <div style={{ fontSize: 15, fontWeight: isSelected ? 600 : 400, flex: 1, lineHeight: 1.5 }}>
                  {language === 'hi' && opt.textHindi ? opt.textHindi : opt.text}
                </div>

                {revealResult && (
                  <div>
                    {isCorrectOption ? (
                      <CheckCircle2 size={20} color="#10b981" />
                    ) : isSelected ? (
                      <XCircle size={20} color="#ef4444" />
                    ) : null}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Revealed Solution & Distractor Analysis Box */}
        {revealResult && (
          <div
            style={{
              backgroundColor: isDark ? '#131f37' : '#ffffff',
              padding: 24,
              borderRadius: 16,
              border: `1px solid ${revealResult.is_user_correct ? '#10b981' : '#f59e0b'}`,
              marginTop: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Lightbulb size={20} color="#f59e0b" />
              <span style={{ fontSize: 16, fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a' }}>
                Solution & Psychometric Distractor Analysis
              </span>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 13 }}>
              <div>
                <strong>Correct Option: </strong>
                <span style={{ color: '#10b981', fontWeight: 800 }}>{revealResult.correct_option_label}</span>
              </div>
              <div>
                <strong>Distractor Classification: </strong>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>{revealResult.closeness_classification}</span>
              </div>
              <div>
                <strong>Marks Awarded: </strong>
                <span style={{ fontWeight: 800 }}>{revealResult.marks_awarded}</span>
              </div>
            </div>

            <div
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: isDark ? '#cbd5e1' : '#334155',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#f8fafc',
                padding: 16,
                borderRadius: 12,
              }}
            >
              {typeof revealResult.explanation === 'string'
                ? revealResult.explanation
                : JSON.stringify(revealResult.explanation, null, 2)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

