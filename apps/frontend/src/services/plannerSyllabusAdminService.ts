import { guardedFetch } from '../utils/apiGuard';

export type PlannerLevel = 'subjects' | 'topics' | 'subtopics';

export interface PlannerExamAdmin {
  id: number;
  code: string;
  label: string;
  group: 'main' | 'optional';
  answer_writing: boolean;
  is_active: boolean;
  sort_order: number;
  /** Question-bank exam type Practice opens; null = every exam. */
  exam_type_id: number | null;
  subjects: number;
  subtopics: number;
}

export interface PlannerSubtopicNode { id: number; name: string; bank_subtopic_id: number | null; bank_label: string | null }
export interface PlannerTopicNode { id: number; name: string; subtopics: PlannerSubtopicNode[] }
export interface PlannerSubjectNode { id: number; name: string; topics: PlannerTopicNode[] }

export type PlannerExamInput = Pick<PlannerExamAdmin, 'code' | 'label' | 'group' | 'answer_writing' | 'is_active' | 'exam_type_id'>;
export interface BankExamType { id: number; code: string; name: string; is_active: boolean }

const BASE = '/api/v1/admin/planner';

function headers(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, '');
  return fallback;
}

async function call<T>(path: string, fallback: string, init: RequestInit = {}): Promise<T> {
  const res = await guardedFetch(`${BASE}${path}`, { ...init, headers: headers() });
  if (!res.ok) throw new Error(await errorMessage(res, fallback));
  return res.status === 204 ? (undefined as T) : res.json();
}

export const listBankExamTypes = () => call<BankExamType[]>('/exam-types', 'Could not load exam types');

export const listPlannerExams = () => call<PlannerExamAdmin[]>('/exams', 'Could not load planner exams');

export const createPlannerExam = (input: PlannerExamInput) =>
  call<PlannerExamAdmin>('/exams', 'Could not add the exam', { method: 'POST', body: JSON.stringify(input) });

export const updatePlannerExam = (id: number, patch: Partial<Omit<PlannerExamInput, 'code'>> & { clear_exam_type?: boolean }) =>
  call<PlannerExamAdmin>(`/exams/${id}`, 'Could not save the exam', { method: 'PATCH', body: JSON.stringify(patch) });

export const deletePlannerExam = (id: number) =>
  call<void>(`/exams/${id}`, 'Could not delete the exam', { method: 'DELETE' });

export const reorderPlannerExams = (ids: number[]) =>
  call<void>('/exams/reorder', 'Could not reorder', { method: 'POST', body: JSON.stringify({ ids }) });

export const fetchPlannerTree = (examId: number) =>
  call<{ exam: PlannerExamAdmin; subjects: PlannerSubjectNode[] }>(`/exams/${examId}/tree`, 'Could not load the syllabus');

export const importPlannerSyllabus = (examId: number, text: string, mode: 'merge' | 'replace') =>
  call<{ added: Record<PlannerLevel, number> }>(`/exams/${examId}/import`, 'Could not import', {
    method: 'POST',
    body: JSON.stringify({ text, mode }),
  });

export const addPlannerNode = (level: PlannerLevel, parentId: number, name: string) =>
  call<{ id: number }>(`/${level}`, 'Could not add', { method: 'POST', body: JSON.stringify({ parent_id: parentId, name }) });

export const updatePlannerNode = (
  level: PlannerLevel,
  id: number,
  patch: { name?: string; bank_subtopic_id?: number; clear_bank?: boolean },
) => call<void>(`/${level}/${id}`, 'Could not save', { method: 'PATCH', body: JSON.stringify(patch) });

export const deletePlannerNode = (level: PlannerLevel, id: number) =>
  call<void>(`/${level}/${id}`, 'Could not delete', { method: 'DELETE' });

export const reorderPlannerNodes = (level: PlannerLevel, ids: number[]) =>
  call<void>(`/${level}/reorder`, 'Could not reorder', { method: 'POST', body: JSON.stringify({ ids }) });

export const searchBankSubtopics = (q: string) =>
  call<{ id: number; label: string }[]>(`/bank-subtopics?q=${encodeURIComponent(q)}`, 'Search failed');
