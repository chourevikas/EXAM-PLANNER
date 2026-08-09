import React from 'react';
import { Bookmark } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Question } from './ExamSectionSidebar';

interface ExamQuestionCardProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selectedOption?: string;
  isBookmarked: boolean;
  language: 'en' | 'hi';
  onSelectOption: (optionLabel: string) => void;
  onToggleBookmark: () => void;
}

export function ExamQuestionCard({
  question,
  questionIndex,
  totalQuestions,
  selectedOption,
  isBookmarked,
  language,
  onSelectOption,
  onToggleBookmark,
}: ExamQuestionCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <main
      style={{
        flex: 1,
        padding: 24,
        overflowY: 'auto',
        boxSizing: 'border-box',
        backgroundColor: isDark ? '#0b1329' : '#f8fafc',
        transition: 'background-color 0.2s'
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
            boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                fontWeight: 700
              }}
            >
              {question.sectionName}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 12,
                backgroundColor:
                  question.difficulty === 'Easy'
                    ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                    : question.difficulty === 'Medium'
                    ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbe0')
                    : (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'),
                color:
                  question.difficulty === 'Easy'
                    ? '#10b981'
                    : question.difficulty === 'Medium'
                    ? '#d97706'
                    : '#ef4444',
                fontWeight: 700
              }}
            >
              {question.difficulty}
            </span>
          </div>

          <button
            onClick={onToggleBookmark}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: isBookmarked ? '#f59e0b' : (isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b'),
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            <Bookmark size={16} fill={isBookmarked ? '#f59e0b' : 'none'} />
            <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
          </button>
        </div>

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
            boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.03)'
          }}
        >
          {language === 'hi' && question.textHindi ? question.textHindi : question.text}
        </div>

        {/* Options Selection Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {question.options.map((opt) => {
            const isSelected = selectedOption === opt.label;

            return (
              <button
                key={opt.label}
                onClick={() => onSelectOption(opt.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 20px',
                  borderRadius: 14,
                  border: isSelected
                    ? '2px solid #2563eb'
                    : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
                  backgroundColor: isSelected
                    ? (isDark ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff')
                    : (isDark ? '#131f37' : '#ffffff'),
                  color: isDark ? '#ffffff' : '#0f172a',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected
                    ? '0 4px 16px rgba(37, 99, 235, 0.18)'
                    : (isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.02)')
                }}
              >
                {/* Option Badge Circle */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: isSelected
                      ? '#2563eb'
                      : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9'),
                    color: isSelected ? '#ffffff' : (isDark ? '#ffffff' : '#0f172a'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    flexShrink: 0,
                    border: `1px solid ${isSelected ? '#2563eb' : (isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1')}`
                  }}
                >
                  {opt.label}
                </div>

                {/* Option Text */}
                <div style={{ fontSize: 15, fontWeight: isSelected ? 600 : 400, flex: 1, lineHeight: 1.5 }}>
                  {language === 'hi' && opt.textHindi ? opt.textHindi : opt.text}
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </main>
  );
}
