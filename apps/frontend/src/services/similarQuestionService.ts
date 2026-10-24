import { useEffect, useState } from 'react';
import { QuestionOut } from '../types/exam';
import { guardedFetch } from '../utils/apiGuard';

/**
 * Knowledge Layer "similar questions" for one question (GET /questions/{id}/similar).
 *
 * Ranked on the backend by shared entities (e.g. Article 15) > concepts > relationships >
 * same Nano Theme > same Microtheme. Scores and match reasons stay internal to the API.
 */
export type SimilarTier = 'exact' | 'related' | 'nano_theme' | 'microtheme';

export interface SimilarQuestionResult {
  question_id: number;
  tier: SimilarTier;
  similarity_score?: number;
  match_reasons: string[];
  question_number?: number | null;
  exam_name?: string | null;
  source_year?: number | null;
  subject_name?: string | null;
  topic_name?: string | null;
  subtopic_name?: string | null;
  question?: any | null;
}

/** A recommendation card tagged with how closely it matched. */
export type SimilarQuestionOut = QuestionOut & {
  similar_tier?: SimilarTier;
  similarity_score?: number;
  match_reasons?: string[];
};

/** Maps a /questions/recommended-style card (also embedded by /similar) to the QuestionOut used by the panels. */
export function recommendationCardToQuestion(
  item: any,
  idx: number,
  fallback: { subject?: string; year?: number | string; exam?: string } = {},
): QuestionOut {
  const optionsList = (item.options || []).map((o: any, oIdx: number) => ({
    option_id: o.option_id || `opt-rec-${idx}-${o.option_label || String.fromCharCode(65 + oIdx)}`,
    option_label: o.option_label || String.fromCharCode(65 + oIdx),
    text: o.option_text || o.text || `Option ${o.option_label || String.fromCharCode(65 + oIdx)}`,
    // Cards don't carry the answer key; correctness comes from /questions/{id}/solution after answering.
    distractor_analysis: o.distractor_analysis || o.explanation || o.description || '',
    translations: o.translations || {},
  }));
  return {
    question_id: item.question_id,
    question_number: 0,
    text: item.question_text || item.text || '',
    passage_text: item.passage_text || null,
    translations: item.translations || {},
    passage_translations: item.passage_translations || {},
    options: optionsList,
    section_code: item.subject_name || fallback.subject || 'Recommended',
    subject: item.subject_name || fallback.subject || 'General Studies',
    topic_name: item.topic_name || item.subject_name || fallback.subject || '',
    subtopic_name: item.subtopic_name,
    difficulty: item.difficulty || 'MEDIUM',
    marks: item.marks || 2.0,
    negative_marks: item.negative_marks || 0.66,
    expected_time_seconds: item.expected_time_seconds || 60,
    source_year: item.source_year || item.exam_year || fallback.year,
    exam_name: item.exam_name || fallback.exam,
  } as any;
}

export async function fetchSimilarQuestions(
  questionId: number | string,
  options: { limit?: number; language?: string; includeQuestion?: boolean; otherYearsOnly?: boolean } = {},
): Promise<SimilarQuestionResult[]> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 5) });
  if (options.includeQuestion) params.append('include_question', 'true');
  if (options.otherYearsOnly) params.append('other_years_only', 'true');
  if (options.language) params.append('language', options.language);
  const res = await guardedFetch(`/api/v1/questions/${questionId}/similar?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

/** Numeric DB ids only — guest/demo placeholder questions have no knowledge data. */
function isRealQuestionId(id: unknown): boolean {
  return id !== null && id !== undefined && /^\d+$/.test(String(id));
}

/**
 * Similar questions for the question currently on screen, as ready-to-render panel cards.
 * Cached per question id + language, so moving back and forth doesn't refetch.
 */
export function useSimilarQuestions(
  questionId: number | string | null | undefined,
  language: string | undefined,
  excludeIds: Set<string>,
  limit = 6,
  /** Only questions from other years (the post-test "same theme in other years" section) */
  otherYearsOnly = false,
): { similar: SimilarQuestionOut[]; isLoading: boolean } {
  const [cache, setCache] = useState<Record<string, SimilarQuestionOut[]>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const key = isRealQuestionId(questionId) ? `${questionId}:${language || 'en'}${otherYearsOnly ? ':other-years' : ''}` : null;

  useEffect(() => {
    if (!key || cache[key]) return;
    let cancelled = false;
    setLoadingKey(key);
    // Over-fetch: the session's own questions are filtered out below and must not consume the limit
    fetchSimilarQuestions(questionId as number | string, { limit: Math.max(limit * 3, 12), language, includeQuestion: true, otherYearsOnly })
      .then((results) => {
        if (cancelled) return;
        const cards = results
          .filter((r) => r.question)
          .map((r, idx) => ({
            ...recommendationCardToQuestion(r.question, idx),
            similar_tier: r.tier,
            similarity_score: r.similarity_score,
            match_reasons: r.match_reasons || [],
          }));
        setCache((prev) => ({ ...prev, [key]: cards }));
      })
      .catch(() => {
        if (!cancelled) setCache((prev) => ({ ...prev, [key]: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoadingKey((current) => (current === key ? null : current));
      });
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const similar = (key ? cache[key] || [] : [])
    .filter((q) => !excludeIds.has(String(q.question_id)))
    .slice(0, limit);
  return { similar, isLoading: key !== null && loadingKey === key };
}

/** Knowledge-based matches first, then the session's other recommendations (no duplicates). */
export function mergeRecommendations<T extends QuestionOut>(similar: T[], pool: T[]): T[] {
  const seen = new Set(similar.map((q) => String(q.question_id)));
  return [...similar, ...pool.filter((q) => !seen.has(String(q.question_id)))];
}
