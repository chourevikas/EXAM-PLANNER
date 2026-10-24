import { guardedFetch } from '../utils/apiGuard';

/** Study Planner v2: plans built from an exam syllabus. Task completion and deletion stay on /study-plan. */
const BASE = '/api/v1/planner';
export const PRO_PLANNER_CODE = 'PRO_STUDY_PLANNER';

/** An exam type's study syllabus: UPSC Prelims, UPSC Mains, UPSC Optional: Geography, MPSC Prelims… */
export interface ExamSyllabus {
  id: number;
  exam_type_id: number;
  exam_type_code: string;
  stage: 'prelims' | 'mains' | 'optional';
  name: string;
  label: string;
  answer_writing: boolean;
}

export interface PlannerExamType { id: number; code: string; name: string; syllabi: ExamSyllabus[] }

export interface PlannerExams {
  /** The student's target exam first. */
  exam_types: PlannerExamType[];
  default_syllabus_id: number | null;
}

export interface PlanRequest {
  syllabus_id: number;
  days: number;
  exam_date?: string | null;
  subjects?: string[] | null;
  subject_days?: Record<string, number>;
  hours: number;
  mock: number | null;
  rest: number | null;
  tail: boolean;
  mix: number;
  ca: boolean;
  pyq: boolean;
  custom_title: string;
  weak_first: boolean;
  auto_catch: boolean;
}

export interface PlannerSettings {
  daily_goal: number;
  weekly_target: number;
  prefs: Partial<PlanRequest>;
  pro: boolean;
  free_max_days: number;
}

export interface PlannerTask {
  id: number;
  date: string;
  title: string;
  subject: string | null;
  topic: string | null;
  subtopic: string | null;
  minutes: number;
  done: boolean;
  block: string | null;
  priority: string;
  activity_type: string;
  planner_subtopic_id: number | null;
  /** Practice filters (closest question-bank match); {} = practice unfiltered; null = no Practice button. */
  practice: { exam?: string; subject?: string; topic?: string; subtopic?: string } | null;
  planned: boolean;
  description: string | null;
}

export interface CountRow { name: string; total: number; done: number }

export interface PlanOverview {
  plan: { syllabus_id: number | null; exam_label: string | null; start_date: string; days: number; options: Partial<PlanRequest> } | null;
  topics: number;
  done: number;
  days: number;
  end_date: string | null;
  subjects: CountRow[];
  day_list: { date: string; total: number; done: number; subjects: string[] }[];
  missed: number;
  auto_catchup: string | null;
}

export interface TrackerData {
  range: 'week' | 'month';
  start: string;
  end: string;
  percent: number;
  done: number;
  total: number;
  hours: number;
  streak: number;
  focus_minutes: number;
  daily_goal: number;
  today_done: number;
  calendar: { date: string; total: number; done: number }[];
  subjects: CountRow[];
  tips: string[];
}

export interface SyllabusSubtopic { id: number; name: string; covered: boolean }
export interface SyllabusData {
  exam: { syllabus_id: number; exam_type: string; stage: string; name: string; label: string; answer_writing: boolean };
  subjects: { id: number; name: string; total: number; done: number; topics: { id: number; name: string; subtopics: SyllabusSubtopic[] }[] }[];
  total: number;
  done: number;
  percent: number;
  week_done: number;
  weekly_target: number;
}

export interface RevisionPlanData {
  sample: boolean;
  subjects: { name: string; accuracy: number; topic: string }[];
  mistakes: { question: string; subject: string; wrong: number; question_id: number }[];
  plan: { subject: string; title: string; minutes: number }[][];
}

/** A refusal because the feature (or plan length) needs Pro. */
export class ProRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProRequiredError';
  }
}

function headers(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function call<T>(path: string, fallback: string, init: RequestInit = {}): Promise<T> {
  const res = await guardedFetch(`${BASE}${path}`, { ...init, headers: headers() });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    if (detail?.code === PRO_PLANNER_CODE) throw new ProRequiredError(detail.message);
    if (typeof detail === 'string') throw new Error(detail);
    if (typeof detail?.message === 'string') throw new Error(detail.message);
    if (Array.isArray(detail) && detail[0]?.msg) throw new Error(String(detail[0].msg).replace(/^Value error, /, ''));
    throw new Error(fallback);
  }
  return res.json();
}

const post = (body?: unknown): RequestInit => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const fetchPlannerExams = () => call<PlannerExams>('/exams', 'Could not load exams');
export const fetchPlannerSettings = () => call<PlannerSettings>('/settings', 'Could not load your planner');
export const savePlannerSettings = (s: { daily_goal?: number; weekly_target?: number }) =>
  call<{ daily_goal: number; weekly_target: number }>('/settings', 'Could not save', { method: 'PUT', body: JSON.stringify(s) });

export const fetchSyllabus = (syllabusId: number) => call<SyllabusData>(`/syllabus/${syllabusId}`, 'Could not load the syllabus');
export const setCoverage = (subtopicId: number, covered: boolean) =>
  call<{ ok: boolean }>(`/coverage/${subtopicId}`, 'Could not save', { method: 'PUT', body: JSON.stringify({ covered }) });

export const estimatePlan = (req: PlanRequest) =>
  call<{ text: string; warning: string | null; topics: number; days: number }>('/estimate', 'Could not estimate', post(req));
export const generatePlan = (req: PlanRequest) =>
  call<{ message: string; warning: string | null; task_count: number; start_date: string; end_date: string }>('/generate', 'Could not generate your plan', post(req));
export const clearPlan = () => call<{ removed: number }>('/plan', 'Could not clear the plan', { method: 'DELETE' });

export const fetchOverview = () => call<PlanOverview>('/overview', 'Could not load your plan');
export const fetchPlanTasks = () => call<PlannerTask[]>('/plan-tasks', 'Could not load your plan');
export const fetchTasksBetween = (start: string, end: string) =>
  call<PlannerTask[]>(`/tasks?start=${start}&end=${end}`, 'Could not load tasks');
export const skipTask = (id: number) => call<{ date: string }>(`/tasks/${id}/skip`, 'Could not move the task', post());
export const reopenTask = (id: number) => call<{ ok: boolean }>(`/tasks/${id}/reopen`, 'Could not undo', post());
export const catchUp = () => call<{ moved: number }>('/catch-up', 'Could not catch up', post());
export const logFocus = (minutes: number, taskId?: number) => call<{ ok: boolean }>('/focus', 'Could not log focus time', post({ minutes, task_id: taskId }));

export const fetchTracker = (range: 'week' | 'month', anchor?: string) =>
  call<TrackerData>(`/tracker?range=${range}${anchor ? `&anchor=${anchor}` : ''}`, 'Could not load progress');

export const fetchRevisionPlan = () => call<RevisionPlanData>('/revision-plan', 'Could not load the revision plan');
export const addRevisionPlan = () => call<{ added: number }>('/revision-plan/add', 'Could not add the revision plan', post());

/** The student's private calendar subscription: feed URL, webcal:// link, and Google Calendar's subscribe page. */
export interface CalendarLinks { url: string; webcal_url: string; google_url: string }

/** The feed is served under this app's own origin (/api is proxied in dev and by nginx in production). */
function calendarLinks({ path }: { path: string }): CalendarLinks {
  const url = `${window.location.origin}${path}`;
  const webcal = `webcal://${url.replace(/^https?:\/\//, '')}`;
  return { url, webcal_url: webcal, google_url: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` };
}

export const fetchCalendarLinks = () => call<{ path: string }>('/calendar', 'Could not load your calendar link').then(calendarLinks);
export const resetCalendarLinks = () => call<{ path: string }>('/calendar/reset', 'Could not reset the link', post()).then(calendarLinks);

export const sharePlan = () => call<{ token: string }>('/share', 'Could not create a share link', post());
export const fetchShare = (token: string) =>
  call<{ exam_label: string | null; tasks: number; days: number }>(`/share/${encodeURIComponent(token)}`, 'This plan link is not valid');
export const importShare = (token: string) =>
  call<{ imported: number }>(`/share/${encodeURIComponent(token)}/import`, 'Could not import the plan', post());
