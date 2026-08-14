import { AdminApprovalRequest, AdminApprovalLog, SystemStats, User } from '../types/auth';

const API_BASE_URL = '/api/v1/admin';

function getAuthHeader() {
  const token = localStorage.getItem('access_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchPendingAdminRequests(): Promise<AdminApprovalRequest[]> {
  const res = await fetch(`${API_BASE_URL}/pending-requests`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch pending requests' }));
    throw new Error(errorData.detail || 'Could not fetch pending admin requests.');
  }
  return await res.json();
}

export async function fetchActiveAdmins(): Promise<AdminApprovalRequest[]> {
  const res = await fetch(`${API_BASE_URL}/active-admins`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch active admins' }));
    throw new Error(errorData.detail || 'Could not fetch active admins.');
  }
  return await res.json();
}

export async function approveAdminRequest(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/approve/${userId}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to approve admin request' }));
    throw new Error(errorData.detail || 'Approval failed.');
  }
  return await res.json();
}

export async function rejectAdminRequest(userId: string, reason?: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/reject/${userId}`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to reject admin request' }));
    throw new Error(errorData.detail || 'Rejection failed.');
  }
  return await res.json();
}

export async function suspendAdmin(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/suspend/${userId}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to suspend admin' }));
    throw new Error(errorData.detail || 'Suspend failed.');
  }
  return await res.json();
}

export async function reactivateAdmin(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/reactivate/${userId}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to reactivate admin' }));
    throw new Error(errorData.detail || 'Reactivation failed.');
  }
  return await res.json();
}

export async function fetchAuditLogs(): Promise<AdminApprovalLog[]> {
  const res = await fetch(`${API_BASE_URL}/audit-logs`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch audit logs' }));
    throw new Error(errorData.detail || 'Could not fetch audit logs.');
  }
  return await res.json();
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const res = await fetch(`${API_BASE_URL}/system-stats`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch system stats' }));
    throw new Error(errorData.detail || 'Could not fetch system stats.');
  }
  return await res.json();
}

export async function fetchAllUsers(): Promise<User[]> {
  const res = await fetch(`/api/v1/users`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch users' }));
    throw new Error(errorData.detail || 'Could not fetch user directory.');
  }
  return await res.json();
}

export async function updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<User> {
  const res = await fetch(`/api/v1/users/${userId}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update user status' }));
    throw new Error(errorData.detail || 'Could not update user status.');
  }
  return await res.json();
}


export async function fetchPipelineStatus(examId: string): Promise<any> {
  const res = await fetch(`/api/v1/pipeline/status/${examId}`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch pipeline status' }));
    throw new Error(errorData.detail || 'Could not fetch pipeline status.');
  }
  return await res.json();
}

export async function stopPipelineTask(examId: string): Promise<any> {
  const res = await fetch(`/api/v1/pipeline/stop/${examId}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to stop pipeline task' }));
    throw new Error(errorData.detail || 'Could not stop task.');
  }
  return await res.json();
}

export async function restartPipelineTask(examId: string, language: string = 'ENGLISH'): Promise<any> {
  const res = await fetch(`/api/v1/pipeline/restart/${examId}?language=${language}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to restart pipeline task' }));
    throw new Error(errorData.detail || 'Could not restart task.');
  }
  return await res.json();
}

export async function retryPipelineTask(examId: string, language: string = 'ENGLISH'): Promise<any> {
  const res = await fetch(`/api/v1/pipeline/retry/${examId}?language=${language}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to retry pipeline task' }));
    throw new Error(errorData.detail || 'Could not retry task.');
  }
  return await res.json();
}

export interface ExamPipelineStatusItem {
  id: string;
  code: string;
  name: string;
  source_year: number;
  stage: string;
  subject_code: string;
  paper_set_code: string;
  status: string;
  is_active: boolean;
  total_questions: number;
  extracted_questions_count: number;
  missing_questions_count: number;
  questions_json_path?: string;
  solutions_json_path?: string;
  questions_json_folder_path?: string;
  solutions_json_folder_path?: string;
}

export async function fetchExamPipelineStatuses(): Promise<ExamPipelineStatusItem[]> {
  const res = await fetch(`${API_BASE_URL}/exams/pipeline-status`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch exam pipeline statuses' }));
    throw new Error(errorData.detail || 'Could not fetch exam pipeline statuses.');
  }
  return await res.json();
}

export async function approveAndPublishExam(examId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/exams/${examId}/approve`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to approve and publish exam' }));
    throw new Error(errorData.detail || 'Exam approval failed.');
  }
  return await res.json();
}

export async function fetchQuestionsByExam(examId: string, page: number = 1, limit: number = 100, status?: string): Promise<any> {
  let url = `/api/v1/questions?exam_id=${examId}&page=${page}&limit=${limit}`;
  if (status && status !== 'ALL') {
    url += `&status=${status}`;
  }
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch questions for exam' }));
    throw new Error(errorData.detail || 'Could not fetch exam questions.');
  }
  return await res.json();
}

export async function updateAdminQuestionDetail(questionId: string, payload: any): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update question' }));
    throw new Error(errorData.detail || 'Question update failed.');
  }
  return await res.json();
}

export async function updateAdminQuestionStatus(questionId: string, status: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update question status' }));
    throw new Error(errorData.detail || 'Status update failed.');
  }
  return await res.json();
}

export async function fetchCatalogQuestions(
  page: number = 1,
  limit: number = 20,
  subjectName?: string,
  status?: string
): Promise<any> {
  let url = `/api/v1/questions?page=${page}&limit=${limit}`;
  if (subjectName && subjectName !== 'All') {
    url += `&subject_name=${encodeURIComponent(subjectName)}`;
  }
  if (status && status !== 'ALL') {
    url += `&status=${status}`;
  }
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch catalog questions' }));
    throw new Error(errorData.detail || 'Could not fetch catalog questions.');
  }
  return await res.json();
}

export interface OverviewMetric {
  title: string;
  value: string;
  badge: string;
  color: string;
  bg: string;
  icon_name: string;
}

export interface RecentUploadItem {
  id: string;
  title: string;
  questions: number;
  date: string;
  status: string;
  confidence: number;
}

export interface SubjectBreakdownItem {
  subject: string;
  count: number;
  percent: number;
  color: string;
}

export interface AdminOverviewStats {
  metrics: OverviewMetric[];
  recent_uploads: RecentUploadItem[];
  subject_breakdown: SubjectBreakdownItem[];
}

export async function fetchAdminOverviewStats(): Promise<AdminOverviewStats> {
  const res = await fetch(`${API_BASE_URL}/overview-stats`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch admin overview statistics' }));
    throw new Error(errorData.detail || 'Could not fetch admin overview stats.');
  }
  return await res.json();
}



