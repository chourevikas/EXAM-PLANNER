import { QuestionOut } from '../../types/exam';
import { QuestionSolutionData } from './QuestionSolutionMarkdownCard';
import { RecommendationSkeletonCard } from './RecommendationSkeletonCard';
import { RecommendedQuestionCard } from './RecommendedQuestionCard';

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
}

export function RecommendedQuestionsPanel({
  title = 'Cross Exam Questions',
  subtitle,
  questions,
  isLoading,
  expandedId,
  selectedOptions,
  solutions,
  solutionLoading,
  onToggleExpand,
  onSelectOption,
}: RecommendedQuestionsPanelProps) {
  return (
    <>
      {title !== null && (
        <div>
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
            <p style={{ fontSize: 11.5, color: '#64748B', margin: 0, lineHeight: 1.35 }}>
              {subtitle}
            </p>
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
              No questions available
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
            />
          ))
        )}
      </div>
    </>
  );
}
