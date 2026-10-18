import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { useSimilarQuestions } from '../../services/similarQuestionService';
import { QuestionSolutionData } from './QuestionSolutionMarkdownCard';
import { RecommendationSkeletonCard } from './RecommendationSkeletonCard';
import { RecommendedQuestionCard } from './RecommendedQuestionCard';

interface SimilarQuestionsSectionProps {
  questionId: number | string | null | undefined;
  language?: string;
  limit?: number;
}

/**
 * "Similar questions" under a solved question (post-exam report): Knowledge Layer matches
 * the student can attempt inline, with the solution revealed after answering.
 * Renders nothing when the question has no similar published questions.
 */
export function SimilarQuestionsSection({ questionId, language = 'en', limit = 4 }: SimilarQuestionsSectionProps) {
  const noExclusions = useMemo(() => new Set<string>(), []);
  // Post-test review: the same theme as it appeared in other years' papers
  const { similar, isLoading } = useSimilarQuestions(questionId, language, noExclusions, limit, true);
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [answers, setAnswers] = useState<Record<string | number, number | string>>({});
  const [solutions, setSolutions] = useState<Record<string | number, QuestionSolutionData>>({});
  const [solutionLoading, setSolutionLoading] = useState<Record<string | number, boolean>>({});

  const loadSolution = async (qId: number | string) => {
    if (solutions[qId] || solutionLoading[qId]) return;
    setSolutionLoading((prev) => ({ ...prev, [qId]: true }));
    try {
      const res = await fetch(`/api/v1/questions/${qId}/solution`);
      if (res.ok) {
        const data = await res.json();
        setSolutions((prev) => ({ ...prev, [qId]: data }));
      }
    } catch (err) {
      console.warn('Similar question solution fetch failed:', err);
    } finally {
      setSolutionLoading((prev) => ({ ...prev, [qId]: false }));
    }
  };

  if (!isLoading && similar.length === 0) return null;

  return (
    <section aria-label="Same theme in other years" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Layers size={15} color="var(--primary-red)" aria-hidden="true" />
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary-red)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Same theme in other years
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
        How this topic was asked in other years&apos; papers. Try one to lock it in.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isLoading && similar.length === 0 ? (
          <>
            <RecommendationSkeletonCard />
            <RecommendationSkeletonCard />
          </>
        ) : (
          similar.map((q, idx) => (
            <RecommendedQuestionCard
              key={q.question_id}
              question={q}
              index={idx}
              isExpanded={expandedId === q.question_id}
              selectedOptionId={answers[q.question_id]}
              onToggleExpand={() => setExpandedId((prev) => (prev === q.question_id ? null : q.question_id))}
              onSelectOption={(optionId) => {
                setAnswers((prev) => ({ ...prev, [q.question_id]: optionId }));
                loadSolution(q.question_id);
              }}
              solution={solutions[q.question_id] ?? null}
              isSolutionLoading={!!solutionLoading[q.question_id]}
              language={language}
            />
          ))
        )}
      </div>
    </section>
  );
}
