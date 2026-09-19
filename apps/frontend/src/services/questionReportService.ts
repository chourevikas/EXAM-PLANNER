import { guardedFetch } from '../utils/apiGuard';

export type ReportReason =
  | 'WRONG_ANSWER'
  | 'WRONG_QUESTION'
  | 'OPTIONS_ISSUE'
  | 'WRONG_EXPLANATION'
  | 'TYPO'
  | 'DUPLICATE'
  | 'OTHER';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'WRONG_ANSWER', label: 'Correct answer looks wrong' },
  { value: 'WRONG_QUESTION', label: 'Question text is wrong or unclear' },
  { value: 'OPTIONS_ISSUE', label: 'Options are wrong, missing or duplicated' },
  { value: 'WRONG_EXPLANATION', label: 'Explanation / solution is wrong' },
  { value: 'TYPO', label: 'Spelling or formatting problem' },
  { value: 'DUPLICATE', label: 'Duplicate of another question' },
  { value: 'OTHER', label: 'Something else' },
];

export const reasonLabel = (reason: string) => REPORT_REASONS.find((r) => r.value === reason)?.label || reason;

export interface QuestionReportItem {
  id: number;
  reporter_name: string;
  reason: ReportReason;
  description: string | null;
  status: 'OPEN' | 'RESOLVED' | 'REJECTED';
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ReportedQuestion {
  question_id: number;
  exam_id?: number | null;
  exam_name?: string | null;
  question_number?: number | null;
  question_text?: string;
  question_status?: string;
  report_count: number;
  reasons: Record<string, number>;
  latest_report_at: string;
  reports: QuestionReportItem[];
}

export interface ReportedQuestionsPage {
  items: ReportedQuestion[];
  total: number;
  page: number;
  limit: number;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function unwrap<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg : null;
    throw new Error(detail || fallback);
  }
  return res.json();
}

/** Student: report a problem with a question. */
export async function reportQuestion(questionId: number | string, reason: ReportReason, description?: string) {
  const res = await guardedFetch(`/api/v1/questions/${encodeURIComponent(questionId)}/report`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ reason, description: description?.trim() || undefined }),
  });
  return unwrap<{ id: number; status: string }>(res, 'Could not submit your report.');
}

/** Admin: reported questions grouped by question. */
export async function fetchReportedQuestions(status: string = 'OPEN', page = 1, limit = 20): Promise<ReportedQuestionsPage> {
  const res = await guardedFetch(`/api/v1/admin/reported-questions?status=${status}&page=${page}&limit=${limit}`, {
    headers: authHeaders(),
  });
  return unwrap<ReportedQuestionsPage>(res, 'Could not load reported questions.');
}

export async function fetchReportedSummary(): Promise<{ open_reports: number; open_questions: number }> {
  const res = await guardedFetch('/api/v1/admin/reported-questions/summary', { headers: authHeaders() });
  return unwrap(res, 'Could not load report summary.');
}

async function act(questionId: number, action: 'reject' | 'resolve' | 'unpublish', note?: string) {
  const res = await guardedFetch(`/api/v1/admin/reported-questions/${questionId}/${action}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ note: note?.trim() || undefined }),
  });
  return unwrap<{ closed: number }>(res, `Could not ${action} the reports.`);
}

export const rejectReports = (questionId: number, note?: string) => act(questionId, 'reject', note);
export const resolveReports = (questionId: number, note?: string) => act(questionId, 'resolve', note);
export const unpublishReportedQuestion = (questionId: number, note?: string) => act(questionId, 'unpublish', note);
