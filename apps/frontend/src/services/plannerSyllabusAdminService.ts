import { guardedFetch } from '../utils/apiGuard';

/** Admin: study syllabi of an exam type (Prelims, Mains, optionals) and their subjects → topics → subtopics. */
export type PlannerLevel = 'subjects' | 'topics' | 'subtopics';
export type SyllabusStage = 'prelims' | 'mains' | 'optional';

export interface ExamSyllabusAdmin {
  id: number;
  exam_type_id: number;
  exam_type_code: string;
  stage: SyllabusStage;
  name: string;
  /** What students see, e.g. "UPSC Prelims", "UPSC Optional: Geography". */
  label: string;
  answer_writing: boolean;
  sort_order: number;
  is_active: boolean;
  subjects: number;
  subtopics: number;
}

export interface PlannerSubtopicNode { id: number; name: string; bank_subtopic_id: number | null; bank_label: string | null }
export interface PlannerTopicNode { id: number; name: string; subtopics: PlannerSubtopicNode[] }
export interface PlannerSubjectNode { id: number; name: string; topics: PlannerTopicNode[] }

const BASE = '/api/v1/admin';

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

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Exam types that have syllabi, each with them (for counts on the Exam Types list). */
export const listAllSyllabi = () =>
  call<{ id: number; code: string; name: string; syllabi: ExamSyllabusAdmin[] }[]>('/syllabi', 'Could not load syllabi');

export const listSyllabi = (examTypeId: number) =>
  call<ExamSyllabusAdmin[]>(`/exam-types/${examTypeId}/syllabi`, 'Could not load the syllabi');

export const createSyllabus = (examTypeId: number, stage: SyllabusStage, name?: string) =>
  call<ExamSyllabusAdmin>(`/exam-types/${examTypeId}/syllabi`, 'Could not add the syllabus', json('POST', { stage, name }));

export const reorderSyllabi = (examTypeId: number, ids: number[]) =>
  call<void>(`/exam-types/${examTypeId}/syllabi/reorder`, 'Could not reorder', json('POST', { ids }));

export const updateSyllabus = (id: number, patch: { name?: string; answer_writing?: boolean; is_active?: boolean }) =>
  call<ExamSyllabusAdmin>(`/syllabi/${id}`, 'Could not save the syllabus', json('PATCH', patch));

export const deleteSyllabus = (id: number) => call<void>(`/syllabi/${id}`, 'Could not delete the syllabus', { method: 'DELETE' });

export const fetchSyllabusTree = (id: number) =>
  call<{ syllabus: ExamSyllabusAdmin; subjects: PlannerSubjectNode[] }>(`/syllabi/${id}/tree`, 'Could not load the syllabus');

export const importSyllabus = (id: number, text: string, mode: 'merge' | 'replace') =>
  call<{ added: Record<PlannerLevel, number> }>(`/syllabi/${id}/import`, 'Could not import', json('POST', { text, mode }));

export const searchBankSubtopics = (syllabusId: number, q: string) =>
  call<{ id: number; label: string }[]>(`/syllabi/${syllabusId}/bank-subtopics?q=${encodeURIComponent(q)}`, 'Search failed');

export const addPlannerNode = (level: PlannerLevel, parentId: number, name: string) =>
  call<{ id: number }>(`/syllabi/nodes/${level}`, 'Could not add', json('POST', { parent_id: parentId, name }));

export const updatePlannerNode = (
  level: PlannerLevel,
  id: number,
  patch: { name?: string; bank_subtopic_id?: number; clear_bank?: boolean },
) => call<void>(`/syllabi/nodes/${level}/${id}`, 'Could not save', json('PATCH', patch));

export const deletePlannerNode = (level: PlannerLevel, id: number) =>
  call<void>(`/syllabi/nodes/${level}/${id}`, 'Could not delete', { method: 'DELETE' });

export const reorderPlannerNodes = (level: PlannerLevel, ids: number[]) =>
  call<void>(`/syllabi/nodes/${level}/reorder`, 'Could not reorder', json('POST', { ids }));
