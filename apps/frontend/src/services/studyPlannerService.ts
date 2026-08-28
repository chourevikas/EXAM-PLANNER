const STUDY_PLAN_API_BASE_URL = '/api/v1/study-plan';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface StudyTaskItem {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  topic?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  allocated_time_minutes?: number;
  activity_type?: string;
  scheduled_date: string;
  is_completed: boolean;
  is_ai_recommended?: boolean;
  source_attempt_id?: string;
  created_at?: string;
}

export interface StudyActivityItem {
  id: string;
  date: string;
  subject: string;
  topic?: string;
  activity_type: string;
  duration_minutes: number;
  questions_attempted?: number;
  questions_correct?: number;
  confidence_rating?: number;
  notes?: string;
  created_at?: string;
}

export interface WeeklyDayData {
  date: string;
  day_name: string;
  is_today: boolean;
  allocated_minutes: number;
  logged_minutes: number;
  completed_tasks_count: number;
  total_tasks_count: number;
  tasks: StudyTaskItem[];
  activities: StudyActivityItem[];
}

export interface WeeklyScheduleResponse {
  start_date: string;
  end_date: string;
  days: WeeklyDayData[];
}

export interface StudySummaryResponse {
  total_logged_hours: number;
  total_logged_minutes: number;
  total_questions_attempted: number;
  total_questions_correct: number;
  subject_breakdown: Record<string, number>;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  subject?: string;
  topic?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  allocated_time_minutes?: number;
  activity_type?: string;
  due_in_days?: number;
}

export interface LogActivityPayload {
  subject: string;
  topic?: string;
  duration_minutes: number;
  activity_type?: string;
  questions_attempted?: number;
  questions_correct?: number;
  confidence_rating?: number;
  notes?: string;
  activity_date?: string;
}

export async function fetchWeeklySchedule(startDate?: string): Promise<WeeklyScheduleResponse> {
  const url = startDate ? `${STUDY_PLAN_API_BASE_URL}/weekly-schedule?start_date=${startDate}` : `${STUDY_PLAN_API_BASE_URL}/weekly-schedule`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch weekly schedule');
  return await res.json();
}

export async function fetchStudyTasks(): Promise<StudyTaskItem[]> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/tasks`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch study tasks');
  return await res.json();
}

export async function createStudyTask(payload: CreateTaskPayload): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to create study task');
  return await res.json();
}

export async function updateStudyTask(taskId: string, payload: Partial<CreateTaskPayload>): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/tasks/${taskId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to update study task');
  return await res.json();
}

export async function deleteStudyTask(taskId: string): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete study task');
  return await res.json();
}

export async function completeStudyTask(taskId: string): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to mark task completed');
  return await res.json();
}

export async function bulkAddTasksFromReport(attemptId: string, tasks: any[]): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/tasks/bulk-from-report`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ attempt_id: attemptId, tasks })
  });
  if (!res.ok) throw new Error('Failed to schedule tasks from diagnostic report');
  return await res.json();
}

export async function logStudyActivity(payload: LogActivityPayload): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/activities`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to log study activity');
  return await res.json();
}

export async function fetchStudyActivities(): Promise<StudyActivityItem[]> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/activities`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch study activities');
  return await res.json();
}

export async function deleteStudyActivity(activityId: string): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/activities/${activityId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete study activity');
  return await res.json();
}

export async function fetchStudyActivitiesSummary(): Promise<StudySummaryResponse> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/activities/summary`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to fetch study summary');
  return await res.json();
}

export async function generateWeeklyStudyPlan(startDate?: string, overwriteExisting: boolean = false): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/generate-weekly-plan`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ start_date: startDate, overwrite_existing: overwriteExisting })
  });
  if (!res.ok) throw new Error('Failed to generate weekly study plan');
  return await res.json();
}

export async function sendPendingTasksEmail(): Promise<any> {
  const res = await fetch(`${STUDY_PLAN_API_BASE_URL}/send-pending-email`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.detail || 'Failed to trigger pending tasks email');
  }
  return data;
}

