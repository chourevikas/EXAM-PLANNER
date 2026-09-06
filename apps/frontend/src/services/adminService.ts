import { AdminApprovalRequest, AdminApprovalLog, SystemStats, User, UserDirectoryItem } from '../types/auth';

const API_BASE_URL = '/api/v1/admin';

function getAuthHeader() {
  let token = localStorage.getItem('access_token');
  if (!token) {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        token = parsed.access_token || parsed.token || null;
      } catch (e) {}
    }
  }
  return {
    'Authorization': `Bearer ${token || ''}`,
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

export async function approveAdminRequest(userId: number | string): Promise<User> {
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

export async function rejectAdminRequest(userId: number | string, reason?: string): Promise<User> {
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

export async function suspendAdmin(userId: number | string): Promise<User> {
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

export async function reactivateAdmin(userId: number | string): Promise<User> {
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

export async function fetchPlatformUsers(): Promise<UserDirectoryItem[]> {
  const res = await fetch(`${API_BASE_URL}/all-users`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch platform users' }));
    throw new Error(errorData.detail || 'Could not fetch user directory.');
  }
  return await res.json();
}

export async function updateUserRole(userId: number | string, newRole: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ new_role: newRole }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update user role' }));
    throw new Error(errorData.detail || 'Could not update user role.');
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

export async function fetchUserById(userId: number | string): Promise<User> {
  const res = await fetch(`/api/v1/users/${userId}`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch user details' }));
    throw new Error(errorData.detail || 'Could not fetch candidate profile.');
  }
  return await res.json();
}

export async function updateUserStatus(userId: number | string, status: 'ACTIVE' | 'SUSPENDED'): Promise<User> {
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


export async function fetchPipelineStatus(examId: number | string): Promise<any> {
  const res = await fetch(`/api/v1/pipeline/status/${examId}`, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch pipeline status' }));
    throw new Error(errorData.detail || 'Could not fetch pipeline status.');
  }
  return await res.json();
}

export async function stopPipelineTask(examId: number | string): Promise<any> {
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

export async function restartPipelineTask(examId: number | string, language: string = 'ENGLISH'): Promise<any> {
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

export async function retryPipelineTask(examId: number | string, language: string = 'ENGLISH'): Promise<any> {
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
  id: number | string;
  code: string;
  name: string;
  source_year: number;
  stage: string;
  subject_code: string;
  paper_set_code: string;
  status: string;
  overall_status?: string;
  is_extracting?: boolean;
  is_active: boolean;
  total_questions: number;
  extracted_questions_count: number;
  missing_questions_count: number;
  published_questions_count?: number;
  pending_questions_count?: number;
  rejected_questions_count?: number;
  key_mapped_count?: number;
  explanations_count?: number;
  has_question_paper?: boolean;
  has_answer_key?: boolean;
  pdf_path?: string;
  answer_key_pdf_path?: string;
  stage1_status?: 'COMPLETED' | 'IN_PROGRESS' | 'MISSING_INPUT' | 'QUEUED';
  stage2_status?: 'COMPLETED' | 'IN_PROGRESS' | 'MISSING_INPUT' | 'QUEUED';
  stage3_status?: 'COMPLETED' | 'IN_PROGRESS' | 'WAITING_INPUTS' | 'QUEUED' | 'ERROR';
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

export interface StuckPipelineItem {
  exam_id: number | string;
  exam_name: string;
  exam_code: string;
  pipeline_type: string;
  status: string;
  current_step: string;
  progress_percent: number;
  extracted_questions_count: number;
  key_mapped_count: number;
  explanations_count: number;
  total_questions: number;
  can_resume: boolean;
}

export async function fetchStuckPipelines(): Promise<StuckPipelineItem[]> {
  const res = await fetch(`${API_BASE_URL}/exams/stuck-pipelines`, { headers: getAuthHeader() });
  if (!res.ok) return [];
  return await res.json();
}

export async function resumeExamPipeline(examId: number | string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/exams/${examId}/resume-pipeline`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to resume pipeline' }));
    throw new Error(errorData.detail || 'Could not resume pipeline.');
  }
  return await res.json();
}

export async function dismissStuckPipeline(examId: number | string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/exams/${examId}/dismiss-stuck-pipeline`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to dismiss prompt' }));
    throw new Error(errorData.detail || 'Could not dismiss prompt.');
  }
  return await res.json();
}

export async function approveAndPublishExam(examId: number | string): Promise<any> {
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

export async function approveAllQuestions(examId: number | string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/exams/${examId}/approve-all-questions`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to approve all questions' }));
    throw new Error(errorData.detail || 'Approving all questions failed.');
  }
  return await res.json();
}

export async function syncExamToS3(
  examId: number | string,
  syncAll: boolean = false,
  syncTarget: 'MASTERS_ONLY' | 'QUESTIONS_MASTER' | 'SOLUTIONS_MASTER' | 'FULL_ALL' = 'MASTERS_ONLY'
): Promise<any> {
  const url = `${API_BASE_URL}/exams/${examId}/sync?sync_all=${syncAll}&sync_target=${syncTarget}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to publish exam' }));
    throw new Error(errorData.detail || 'Exam publish failed.');
  }
  return await res.json();
}

export interface ExamSyncStatusResponse {
  exam_id: number | string;
  exam_code: string;
  is_published: boolean;
  is_syncing: boolean;
  sync_status: string;
  current_step?: string | null;
  progress_percent?: number;
  error_log?: string | null;
  last_synced_at?: string | null;
  updated_at?: string | null;
  is_s3_out_of_sync?: boolean;
  questions_json_path?: string | null;
  solutions_json_path?: string | null;
  questions_json_folder_path?: string | null;
  solutions_json_folder_path?: string | null;
}

export async function fetchExamSyncStatus(examId: number | string): Promise<ExamSyncStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/exams/${examId}/sync-status`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch exam sync status' }));
    throw new Error(errorData.detail || 'Could not fetch exam sync status.');
  }
  return await res.json();
}

export interface ExamReviewQuestionsResponse {
  exam_id: number | string;
  exam_name?: string;
  exam_code?: string;
  stage?: string;
  source_year?: number;
  paper_set_code?: string;
  total_questions: number;
  reviewed_count: number;
  pending_count: number;
  rejected_count: number;
  can_publish: boolean;
  is_published?: boolean;
  publish_status?: 'PUBLISHED' | 'PUBLISH_FAILED' | 'CORRUPTED' | 'READY_FOR_PUBLISH' | 'PENDING_REVIEW';
  can_retry?: boolean;
  is_corrupted?: boolean;
  publish_error?: string;
  corruption_reason?: string;
  questions_json_path?: string;
  solutions_json_path?: string;
  questions_json_folder_path?: string;
  solutions_json_folder_path?: string;
  last_synced_at?: string | null;
  updated_at?: string | null;
  is_s3_out_of_sync?: boolean;
  is_syncing?: boolean;
  items: any[];
  page: number;
  limit: number;
  pages: number;
}

const _examReviewCache = new Map<string, { data: ExamReviewQuestionsResponse; timestamp: number }>();
const _examIntegrityCache = new Map<string, { data: ExamIntegrityQuestionsResponse; timestamp: number }>();
const EXAM_REVIEW_CACHE_TTL = 5 * 60 * 1000;

export function invalidateExamReviewCache(examId?: number | string) {
  if (examId !== undefined) {
    const prefix = `exam_${examId}_`;
    for (const key of _examReviewCache.keys()) {
      if (key.startsWith(prefix)) _examReviewCache.delete(key);
    }
    for (const key of _examIntegrityCache.keys()) {
      if (key.startsWith(prefix)) _examIntegrityCache.delete(key);
    }
  } else {
    _examReviewCache.clear();
    _examIntegrityCache.clear();
  }
}

export async function fetchExamQuestionsForReview(
  examId: number | string,
  page: number = 1,
  limit: number = 10,
  status?: string
): Promise<ExamReviewQuestionsResponse> {
  const cacheKey = `exam_${examId}_p${page}_l${limit}_s${status || 'ALL'}`;
  const cached = _examReviewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < EXAM_REVIEW_CACHE_TTL) {
    return cached.data;
  }

  let url = `${API_BASE_URL}/exams/${examId}/review-questions?page=${page}&limit=${limit}`;
  if (status && status !== 'ALL') {
    url += `&status=${status}`;
  }
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch exam review questions' }));
    throw new Error(errorData.detail || 'Could not fetch exam review questions.');
  }
  const data: ExamReviewQuestionsResponse = await res.json();
  _examReviewCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function fetchQuestionsByExam(examId: number | string, page: number = 1, limit: number = 100, status?: string): Promise<any> {
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

export async function updateAdminQuestionDetail(questionId: number | string, payload: any): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update question' }));
    throw new Error(errorData.detail || 'Question update failed.');
  }
  invalidateExamReviewCache();
  return await res.json();
}

export async function updateAdminQuestionStatus(questionId: number | string, status: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to update question status' }));
    throw new Error(errorData.detail || 'Status update failed.');
  }
  invalidateExamReviewCache();
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
  id: number | string;
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


export interface QuestionOptionPayload {
  option_id?: string | number;
  option_label: string;
  display_order?: number;
  option_text: string;
  is_correct: boolean;
  distractor_analysis?: string;
  closeness_score?: number;
}

export interface QuestionCreatePayload {
  exam_id: string | number;
  question_number_in_paper: number;
  question_text: string;
  paper_set_code?: string;
  section_code?: string;
  question_type?: string;
  difficulty?: string;
  marks?: number;
  negative_marks?: number;
  expected_time_seconds?: number;
  options?: QuestionOptionPayload[];
  passage_text?: string;
  core_concept?: string;
  detailed_solution?: string;
  common_traps?: string[];
  key_takeaways?: string[];
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
  subject_id?: string | number;
  topic_id?: string | number;
  subtopic_id?: string | number;
  language?: string;
}

export interface QuestionIssueDetail {
  question_id?: string | null;
  question_number_in_paper: number;
  status: string;
  issue_category: 'MISSING_IN_PAPER' | 'CORRUPTED' | 'PARTIALLY_CORRUPTED' | 'VALID';
  issues: string[];
  has_statement?: boolean;
  has_options?: boolean;
  has_correct_option?: boolean;
  has_explanation?: boolean;
  has_valid_syllabus?: boolean;
  subject?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  question_text_preview?: string | null;
  options_count?: number;
  is_complete?: boolean;
  requires_human_review?: boolean;
}

export interface ExamIntegrityQuestionsResponse {
  exam_id: string | number;
  exam_name?: string;
  paper_set_code?: string;
  total_expected_questions: number;
  total_extracted_questions: number;
  corrupted_count: number;
  partially_corrupted_count: number;
  missing_count: number;
  valid_count: number;
  missing_question_numbers: number[];
  is_extracting?: boolean;
  page: number;
  limit: number;
  total_items: number;
  pages: number;
  items: QuestionIssueDetail[];
}

export async function createAdminQuestion(payload: QuestionCreatePayload): Promise<any> {
  const res = await fetch('/api/v1/questions', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to create question' }));
    throw new Error(errorData.detail || 'Question creation failed.');
  }
  invalidateExamReviewCache(payload.exam_id);
  return await res.json();
}

export async function fetchExamIntegrityQuestions(
  examId: string | number,
  issueType?: string,
  page: number = 1,
  limit: number = 250
): Promise<ExamIntegrityQuestionsResponse> {
  const cacheKey = `exam_${examId}_issue_${issueType || 'ALL'}_p${page}_l${limit}`;
  const cached = _examIntegrityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < EXAM_REVIEW_CACHE_TTL) {
    return cached.data;
  }

  let url = `/api/v1/exams/${encodeURIComponent(examId)}/integrity-questions?page=${page}&limit=${limit}`;
  if (issueType && issueType !== 'ALL') {
    url += `&issue_type=${encodeURIComponent(issueType)}`;
  }
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch exam integrity questions' }));
    throw new Error(errorData.detail || 'Could not fetch exam integrity questions.');
  }
  const data: ExamIntegrityQuestionsResponse = await res.json();
  _examIntegrityCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function fetchExamsByYear(): Promise<any> {
  const res = await fetch('/api/v1/exams/by-year', { headers: getAuthHeader() });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch exams grouped by year' }));
    throw new Error(errorData.detail || 'Could not fetch exams by year.');
  }
  return await res.json();
}

const _adminSyllabusCache = new Map<string, { data: any; timestamp: number }>();
const ADMIN_SYLLABUS_CACHE_TTL = 10 * 60 * 1000;

export async function fetchMasterSyllabus(examId?: string | number): Promise<any> {
  const cacheKey = examId ? `exam_${examId}` : 'master';
  const cached = _adminSyllabusCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ADMIN_SYLLABUS_CACHE_TTL) {
    return cached.data;
  }

  const url = examId ? `/api/v1/exams/${encodeURIComponent(examId)}/syllabus` : '/api/v1/syllabus';
  const res = await fetch(url, { headers: getAuthHeader() });
  if (!res.ok) {
    const fallbackRes = await fetch(`/api/v1/syllabus?exam_id=${encodeURIComponent(examId || '')}`, { headers: getAuthHeader() });
    if (!fallbackRes.ok) {
      const errorData = await res.json().catch(() => ({ detail: 'Failed to fetch syllabus hierarchy' }));
      throw new Error(errorData.detail || 'Could not fetch syllabus.');
    }
    const data = await fallbackRes.json();
    _adminSyllabusCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }
  const data = await res.json();
  _adminSyllabusCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function verifySyllabusTaxonomy(subject: string, topic: string, subtopic: string): Promise<any> {
  const res = await fetch('/api/v1/syllabus/verify', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ subject, topic, subtopic }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Failed to verify syllabus node' }));
    throw new Error(errorData.detail || 'Syllabus node verification failed.');
  }
  return await res.json();
}




