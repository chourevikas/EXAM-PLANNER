import React from 'react';
import { QuestionOut } from '../../types/exam';
import { QuestionSolutionData } from './QuestionSolutionMarkdownCard';
import { RecommendationSkeletonCard } from './RecommendationSkeletonCard';
import { RecommendedQuestionCard } from './RecommendedQuestionCard';
import { SlidersHorizontal } from 'lucide-react';

export interface RecFilterToggles {
  subject: boolean;
  topic: boolean;
  subtopic: boolean;
  difficulty: boolean;
}

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
  recFilterToggles?: RecFilterToggles;
  onToggleRecFilter?: (filterKey: keyof RecFilterToggles) => void;
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
  recFilterToggles = { subject: true, topic: true, subtopic: true, difficulty: true },
  onToggleRecFilter,
  language,
}: RecommendedQuestionsPanelProps) {
  const filterItems: { key: keyof RecFilterToggles; label: string }[] = [
    { key: 'subject', label: 'Subject' },
    { key: 'topic', label: 'Topic' },
    { key: 'subtopic', label: 'Subtopic' },
    { key: 'difficulty', label: 'Difficulty' },
  ];

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
              <div style={{ width: 7, height: 7, borderRadius: 0, backgroundColor: '#1E3A8A' }} />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#1E3A8A',
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
                color: '#475569',
                backgroundColor: '#F1F5F9',
                padding: '1px 6px',
                borderRadius: 0,
              }}
            >
              {questions.length} Qs
            </span>
          </div>
          {subtitle && (
            <p style={{ fontSize: 11.5, color: '#64748B', margin: '0 0 8px 0', lineHeight: 1.35 }}>
              {subtitle}
            </p>
          )}

          {/* Granular Recommendation Filter Toggles Bar */}
          {onToggleRecFilter && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                padding: '6px 8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 4,
                marginTop: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
                <SlidersHorizontal size={11} color="#64748B" />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Rec Filters:
                </span>
              </div>
              {filterItems.map((item) => {
                const isActive = recFilterToggles[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onToggleRecFilter(item.key)}
                    title={`Toggle ${item.label} filter for recommendations ${isActive ? '(ON)' : '(OFF)'}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: isActive ? '1px solid #1E3A8A' : '1px solid #CBD5E1',
                      backgroundColor: isActive ? '#EFF6FF' : '#FFFFFF',
                      color: isActive ? '#1E3A8A' : '#64748B',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 1px 2px rgba(30, 58, 138, 0.08)' : 'none',
                    }}
                  >
                    <span>{item.label}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: 3,
                        backgroundColor: isActive ? '#1E3A8A' : '#94A3B8',
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
                color: '#94A3B8',
                textAlign: 'center',
                padding: '16px 0',
              }}
            >
              No questions available matching active rec filters
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
