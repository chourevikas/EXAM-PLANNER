import React from 'react';
import { QuestionOut } from '../../types/exam';
import { QuestionSolutionData } from './QuestionSolutionMarkdownCard';
import { RecommendationSkeletonCard } from './RecommendationSkeletonCard';
import { RecommendedQuestionCard } from './RecommendedQuestionCard';
import { SlidersHorizontal } from 'lucide-react';

export type ExamFilterToggles = Record<string, boolean>;
// Retain alias for backward compatibility
export type RecFilterToggles = ExamFilterToggles;

export const DEFAULT_REC_EXAMS = ['UPSC', 'MPPSC', 'BPSC', 'UPPCS'];

interface RecommendedQuestionsPanelProps {
  title?: string | null;
  subtitle?: string;
  questions: QuestionOut[];
  isLoading: boolean;
  expandedId: number | string | null;
  selectedOptions: Record<string | number, number | string>;
  solutions: Record<string | number, QuestionSolutionData>;
  solutionLoading: Record<string | number, boolean>;
  onToggleExpand: (q: QuestionOut) => void;
  onSelectOption: (q: QuestionOut, optionId: number | string) => void;
  examFilterToggles?: ExamFilterToggles;
  onToggleExamFilter?: (examName: string) => void;
  availableExams?: string[];
  // Backwards compatible aliases
  recFilterToggles?: ExamFilterToggles;
  onToggleRecFilter?: (examName: string) => void;
  language?: string;
}

export function RecommendedQuestionsPanel({
  title = 'Cross Exam Similar Questions',
  subtitle,
  questions,
  isLoading,
  expandedId,
  selectedOptions,
  solutions,
  solutionLoading,
  onToggleExpand,
  onSelectOption,
  examFilterToggles,
  onToggleExamFilter,
  availableExams = DEFAULT_REC_EXAMS,
  recFilterToggles,
  onToggleRecFilter,
  language,
}: RecommendedQuestionsPanelProps) {
  const activeToggles = examFilterToggles || recFilterToggles || { UPSC: true, MPPSC: false, BPSC: false, UPPCS: false };
  const toggleHandler = onToggleExamFilter || onToggleRecFilter;

  // Filter exams list
  const examList = (availableExams && availableExams.length > 0) ? availableExams : DEFAULT_REC_EXAMS;
  const anyExamActive = Object.values(activeToggles).some(Boolean);

  return (
    <>
      {title !== null && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: 'var(--radius)', backgroundColor: 'var(--primary-red)' }} />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: 'var(--primary-red)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {title}
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-hover)',
                padding: '1px 6px',
                borderRadius: 'var(--radius)',
              }}
            >
              {questions.length} Qs
            </span>
          </div>
          {subtitle && (
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '0 0 8px 0', lineHeight: 1.35 }}>
              {subtitle}
            </p>
          )}

          {/* Exam Recommendation Filter Toggles Bar (UPSC, MPPSC, BPSC, UPPCS) */}
          {toggleHandler && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                padding: '6px 8px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid #E2E8F0',
                borderRadius: 4,
                marginTop: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
                <SlidersHorizontal size={11} color="var(--text-muted)" />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Exams:
                </span>
              </div>
              {examList.map((examName) => {
                const isActive = !!activeToggles[examName];
                return (
                  <button
                    key={examName}
                    type="button"
                    onClick={() => toggleHandler(examName)}
                    title={`Toggle ${examName} questions ${isActive ? '(ON)' : '(OFF)'}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: isActive ? '1px solid var(--primary-red)' : '1px solid #CBD5E1',
                      backgroundColor: isActive ? '#EFF6FF' : '#FFFFFF',
                      color: isActive ? 'var(--primary-red)' : '#64748B',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 1px 2px rgba(var(--primary-red-rgb), 0.08)' : 'none',
                    }}
                  >
                    <span>{examName}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: 3,
                        backgroundColor: isActive ? 'var(--primary-red)' : '#94A3B8',
                        color: '#FFFFFF',
                        letterSpacing: '0.04em',
                        lineHeight: 1.2,
                      }}
                    >
                      {isActive ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {questions.length === 0 ? (
          isLoading ? (
            <>
              <RecommendationSkeletonCard />
              <RecommendationSkeletonCard />
              <RecommendationSkeletonCard />
            </>
          ) : (
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-disabled)',
                textAlign: 'center',
                padding: '16px 8px',
                lineHeight: 1.4,
              }}
            >
              {anyExamActive
                ? 'No similar questions found for the selected exam(s)'
                : 'All exam toggles are OFF. Turn on an exam toggle above (e.g. UPSC) to view recommendations.'}
            </div>
          )
        ) : (
          questions.map((rec, idx) => (
            <RecommendedQuestionCard
              key={rec.question_id || idx}
              question={rec}
              index={idx}
              isExpanded={expandedId === rec.question_id}
              selectedOptionId={selectedOptions[rec.question_id]}
              onToggleExpand={() => onToggleExpand(rec)}
              onSelectOption={(optionId) => onSelectOption(rec, optionId)}
              solution={solutions[rec.question_id] ?? null}
              isSolutionLoading={!!solutionLoading[rec.question_id]}
              language={language}
            />
          ))
        )}
      </div>
    </>
  );
}
