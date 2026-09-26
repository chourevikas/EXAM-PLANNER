import { extractCanonicalExamName } from './formatEnum';

interface ExamsByYearData {
  years?: number[];
  exams_by_year?: Record<string, any[]>;
}

/**
 * Years a student can filter questions by: years with a paper of the chosen exams, plus the years of
 * questions inside mixed question banks of those exams (listed under "MIXED" with their question_years).
 * `canonicalExams` null or empty means every exam.
 */
export function availableQuestionYears(data: ExamsByYearData | null | undefined, canonicalExams?: string[] | null): number[] {
  if (!data) return [];
  const byYear = data.exams_by_year || {};
  const wanted = canonicalExams && canonicalExams.length > 0 ? new Set(canonicalExams) : null;
  const matches = (e: any) => !wanted || wanted.has(extractCanonicalExamName(e.name || e.code));

  const years = new Set<number>();
  for (const y of data.years || []) {
    if (!wanted || (byYear[String(y)] || []).some(matches)) years.add(y);
  }
  for (const bank of byYear.MIXED || []) {
    if (matches(bank)) (bank.question_years || []).forEach((y: number) => years.add(y));
  }
  return Array.from(years).sort((a, b) => b - a);
}
