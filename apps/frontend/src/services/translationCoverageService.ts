import { guardedFetch } from '../utils/apiGuard';

export type CoverageKind = 'questions' | 'options' | 'explanations' | 'analyses';
export type CoverageCounts = Record<CoverageKind, number>;

export interface TranslationRun {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  step: string;
  progress_percent: number;
  error: string | null;
  completed_at: string | null;
}

export interface ExamCoverage {
  exam_id: number;
  name: string;
  code: string;
  questions: number;
  options: number;
  /** Keyed by language code: en, hi, mr */
  by_language: Record<string, CoverageCounts>;
  /** Items still to translate into the non-English languages */
  missing: number;
  translation_run: TranslationRun | null;
}

export interface TranslationCoverage {
  languages: { code: string; name: string; native_name: string }[];
  totals: { questions: number; options: number; missing: number; by_language: Record<string, CoverageCounts> };
  exams: ExamCoverage[];
}

const BASE = '/api/v1/admin/translations';

function headers(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.detail === 'string' ? body.detail : fallback;
}

export async function fetchTranslationCoverage(): Promise<TranslationCoverage> {
  const res = await guardedFetch(BASE, { headers: headers() });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not load translation coverage'));
  return res.json();
}

export async function translateExam(examId: number): Promise<void> {
  const res = await guardedFetch(`${BASE}/exams/${examId}`, { method: 'POST', headers: headers() });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not start the translation'));
}

export async function translateAllMissing(): Promise<void> {
  const res = await guardedFetch(`${BASE}/run-all`, { method: 'POST', headers: headers() });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not start the translation'));
}
