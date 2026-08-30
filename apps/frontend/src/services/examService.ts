import {
  UploadExamPayload,
  UploadExamResponse,
  StartExamRequest,
  StartExamResponse,
  QuestionNavResponse,
  SaveResponseRequest,
  SaveResponseResponse,
  RevealAnswerResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  ExamStatusResponse,
  SubmitExamRequest,
  SubmitExamResponse,
  PsychometricReport,
} from '../types/exam';

const API_BASE_URL = '/api/v1';

function getAuthHeaders(customToken?: string): Record<string, string> {
  let token = customToken || localStorage.getItem('access_token');
  if (!token && (window as any).Clerk?.session) {
    token = (window as any).Clerk.session.lastActiveToken?.jwt;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function uploadExamPaper({
  examName,
  year,
  paperType,
  set_code = 'SET_A',
  file,
}: UploadExamPayload & { set_code?: string }): Promise<UploadExamResponse> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const formData = new FormData();
  formData.append('exam_name', examName);
  formData.append('year', year);
  formData.append('paper_type', paperType);
  formData.append('set_code', set_code || 'SET_A');
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/exams/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail || 'Server error occurred during file upload.');
  }

  return result;
}

export async function uploadAnswerKey({
  examName,
  year,
  set_code,
  file,
}: {
  examName: string;
  year: string;
  set_code: string;
  file: File;
  conflict_resolution?: string;
}): Promise<UploadExamResponse> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const formData = new FormData();
  formData.append('exam_name', examName);
  formData.append('year', year);
  formData.append('set_code', set_code);
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/pipeline/upload-answer-key`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail || 'Server error occurred during Answer Key upload.');
  }

  return result;
}

/** 1. Start Exam Attempt */
export async function startExamAttempt(payload: StartExamRequest): Promise<StartExamResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to start exam session.');
  }
  return data;
}

/** 2. Fetch Question by 1-indexed Question Number */
export async function getQuestionByNumber(
  attemptId: number | string,
  questionNumber: number,
  language: string = 'ENGLISH'
): Promise<QuestionNavResponse> {
  const url = `${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/questions/${questionNumber}?language=${encodeURIComponent(language)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || `Failed to fetch question #${questionNumber}.`);
  }
  return data;
}

/** 3. Save Question Response & Telemetry */
export async function saveQuestionResponse(
  attemptId: number | string,
  payload: SaveResponseRequest
): Promise<SaveResponseResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/responses`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to save question response.');
  }
  return data;
}

/** 4. Reveal Answer (Practice / Revision mode) */
export async function revealQuestionAnswer(
  attemptId: number | string,
  questionId: number | string
): Promise<RevealAnswerResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/reveal/${encodeURIComponent(questionId)}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to reveal answer for question.');
  }
  return data;
}

/** 5. Periodic Exam Heartbeat Sync */
export async function sendExamHeartbeat(
  attemptId: number | string,
  payload: HeartbeatRequest
): Promise<HeartbeatResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/heartbeat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to sync exam timer heartbeat.');
  }
  return data;
}

/** 6. Get Exam Session Status & Palette (Resume Session) */
export async function getExamAttemptStatus(attemptId: number | string): Promise<ExamStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/status`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to fetch exam session status.');
  }
  return data;
}

/** 7. Submit Exam Attempt */
export async function submitExamAttempt(
  attemptId: number | string,
  payload: SubmitExamRequest = { submission_reason: 'USER_CLICKED_SUBMIT' }
): Promise<SubmitExamResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to submit exam attempt.');
  }
  return data;
}

/** 8. Get Submitted Attempt Summary Result */
export async function getAttemptResult(attemptId: number | string): Promise<SubmitExamResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/result`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to fetch attempt result.');
  }
  return data;
}

/** 9. Fetch Psychometric Diagnostic Report JSON */
export async function getPsychometricReportJson(attemptId: number | string): Promise<PsychometricReport> {
  const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${encodeURIComponent(attemptId)}/json`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Psychometric report is not yet available or failed to compute.');
  }
  return data;
}

export interface ExamItem {
  id: number | string;
  code: string;
  name: string;
  exam_type: 'PYQ' | 'STATIC_MOCK' | string;
  stage?: string;
  subject_code?: string;
  source_year?: number;
  paper_set_code?: string;
  total_duration_minutes?: number;
  total_marks?: number;
  description?: string;
  is_active: boolean;
  status?: string;
}

/** 11. Fetch All Available Registered Exams */
export async function listExams(status?: string, includeInactive: boolean = false, customToken?: string): Promise<ExamItem[]> {
  try {
    let url = `${API_BASE_URL}/exams`;
    if (status) {
      url += `?status=${encodeURIComponent(status)}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(customToken),
    });
    if (!response.ok) {
      return [];
    }
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch registered exams:', err);
    return [];
  }
}

export function formatCanonicalExamTitle(exam: ExamItem): string {
  if (exam.name) return exam.name;
  return `${exam.exam_type} ${exam.source_year || ''}`.trim();
}
export interface AttemptHistoryItem {
  attempt_id: number | string;
  exam_id: number | string;
  exam_name: string;
  mode: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED' | 'EVALUATED' | string;
  total_score: number;
  max_possible_score: number;
  total_questions: number;
  started_at: string;
  submitted_at?: string;
}

function cleanAttemptId(attemptId: number | string): number | string {
  if (typeof attemptId === 'number') return attemptId;
  const str = String(attemptId).trim();
  const parsed = parseInt(str, 10);
  return (!isNaN(parsed) && String(parsed) === str) ? parsed : attemptId;
}

/** 12. Fetch Candidate Attempts History with clean pagination */
export async function listCandidateAttempts(
  options?: { page?: number; limit?: number; status?: string; customToken?: string } | string
): Promise<AttemptHistoryItem[]> {
  try {
    let customToken: string | undefined;
    let page = 1;
    let limit = 20;
    let statusFilter: string | undefined;

    if (typeof options === 'string') {
      customToken = options;
    } else if (options && typeof options === 'object') {
      page = options.page || 1;
      limit = options.limit || 20;
      statusFilter = options.status;
      customToken = options.customToken;
    }

    let url = `${API_BASE_URL}/attempts?page=${page}&page_size=${limit}`;
    if (statusFilter) {
      url += `&status_filter=${encodeURIComponent(statusFilter)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(customToken),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.items || (Array.isArray(data) ? data : []);
  } catch (err) {
    console.warn('Failed to fetch candidate attempt history:', err);
    return [];
  }
}




export async function getAllAttemptQuestionsBulk(
  attemptId: number | string,
  language: string = 'ENGLISH',
  presignedUrl?: string | null
): Promise<any> {
  // 1. Primary Strategy: Fetch directly from S3 presigned URL for instant loading & 0 server load
  if (presignedUrl) {
    try {
      const res = await fetch(presignedUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data.questions) || Array.isArray(data))) {
          return { questions: data.questions || data };
        }
      }
    } catch (err) {
      console.warn('Presigned URL fetch failed, falling back to API bulk endpoint:', err);
    }
  }

  // 2. Secondary Strategy: Fetch from FastAPI backend bulk questions endpoint
  try {
    const url = `${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/questions/bulk?language=${encodeURIComponent(language)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      return { questions: data.questions || (Array.isArray(data) ? data : []) };
    }
  } catch (err) {
    console.warn('Failed to fetch bulk questions from API:', err);
  }

  return { questions: [] };
}

export async function prefetchQuestion(attemptId: number | string, qNum: number, lang: string = 'ENGLISH'): Promise<void> {
  try {
    const url = `${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/questions/${qNum}?language=${encodeURIComponent(lang)}`;
    fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    }).catch(() => { });
  } catch (_) { }
}

export async function saveQuestionResponsesBatch(attemptId: number | string, payload: any): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/responses/batch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.warn('Batch response sync warning:', response.status, errBody);
      return { status: 'FAILED', error: errBody };
    }
    return await response.json();
  } catch (err) {
    console.warn('Network error during saveQuestionResponsesBatch:', err);
    return { status: 'FAILED', error: String(err) };
  }
}

export async function getResponseBatchStatus(attemptId: number | string, batchId: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/attempts/${encodeURIComponent(attemptId)}/responses/batch/${batchId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      return { status: 'PROCESSED' };
    }
    return await response.json();
  } catch (err) {
    console.warn('Network error during getResponseBatchStatus:', err);
    return { status: 'PROCESSED' };
  }
}

export async function getAttemptEvaluationStatus(attemptId: number | string): Promise<any> {
  try {
    const cleanId = cleanAttemptId(attemptId);
    if (String(cleanId) === 'CUMULATIVE_ALL' || isNaN(Number(cleanId))) {
      return { is_ready: true, status: 'COMPLETED' };
    }
    const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${encodeURIComponent(cleanId)}/status`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      return { is_ready: false, status: 'UNKNOWN' };
    }
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch attempt evaluation status:', err);
    return { is_ready: false, status: 'UNKNOWN' };
  }
}

export async function retryAttemptEvaluation(attemptId: number | string): Promise<any> {
  const cleanId = cleanAttemptId(attemptId);
  const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${encodeURIComponent(cleanId)}/retry`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to retry evaluation.');
  }
  return await response.json();
}

export async function pollAttemptReportUntilReady(
  attemptId: number | string,
  onUpdate: (status: any) => void,
  maxRetries: number = 30,
  delay: number = 6000,
  isCancelled?: () => boolean
): Promise<boolean> {
  const cleanId = cleanAttemptId(attemptId);
  for (let i = 0; i < maxRetries; i++) {
    if (isCancelled && isCancelled()) return false;
    try {
      const status = await getAttemptEvaluationStatus(cleanId);
      if (isCancelled && isCancelled()) return false;
      if (onUpdate) onUpdate(status);
      if (status) {
        if (status.is_failed || status.status === 'FAILED') {
          return false;
        }
        if (status.is_ready || status.status === 'COMPLETED' || status.status === 'EVALUATED') {
          return true;
        }
      }
    } catch (err) {
      console.warn('Polling error:', err);
    }
    if (isCancelled && isCancelled()) return false;
    // Wait strictly AFTER previous request responded before polling again
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
}

export async function getAttemptQuestionReport(attemptId: number | string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${encodeURIComponent(attemptId)}/questions`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch attempt question report:', err);
    return null;
  }
}

export async function getAttemptUserProgressionReport(attemptId: number | string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${encodeURIComponent(attemptId)}/user-delta`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch user progression report:', err);
    return null;
  }
}

export async function getUserCumulativeAggregateReport(userId?: number | string): Promise<any> {
  try {
    const target = userId || 'me';
    const response = await fetch(`${API_BASE_URL}/analytics/users/${encodeURIComponent(target)}/aggregate-report`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch user cumulative aggregate report:', err);
    return null;
  }
}

export async function fetchMasterSyllabus(examId?: number | string): Promise<any> {
  try {
    const url = examId ? `${API_BASE_URL}/syllabus?exam_id=${encodeURIComponent(examId)}` : `${API_BASE_URL}/syllabus`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch master syllabus hierarchy:', err);
    return null;
  }
}

export async function fetchExamsByYear(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/exams/by-year`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch exams grouped by year:', err);
    return null;
  }
}

export async function verifySyllabusNode(payload: { subject?: string; topic?: string; subtopic?: string }): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/syllabus/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to verify syllabus node:', err);
    return null;
  }
}

export async function fetchExamSyllabusTree(examId: number | string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/exams/${encodeURIComponent(examId)}/syllabus`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch exam syllabus tree:', err);
    return null;
  }
}

export async function fetchExamIntegrityQuestions(examId: string, status?: string): Promise<any> {
  try {
    const url = status
      ? `${API_BASE_URL}/exams/${encodeURIComponent(examId)}/integrity-questions?status=${encodeURIComponent(status)}`
      : `${API_BASE_URL}/exams/${encodeURIComponent(examId)}/integrity-questions`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch exam integrity diagnostics:', err);
    return null;
  }
}

export async function bulkAddStudyTasksFromReport(payload: {
  attempt_id: string;
  tasks: any[];
}): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/study-plan/tasks/bulk-from-report`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to schedule study tasks.');
  }
  return data;
}

export async function getAttemptScheduledTasksStatus(attemptId: string): Promise<{ attempt_id: string; scheduled_task_titles: string[]; tasks: any[] }> {
  try {
    const response = await fetch(`${API_BASE_URL}/study-plan/tasks/attempt/${encodeURIComponent(attemptId)}/status`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) return { attempt_id: attemptId, scheduled_task_titles: [], tasks: [] };
    return await response.json();
  } catch (err) {
    console.warn('Failed to fetch attempt scheduled tasks status:', err);
    return { attempt_id: attemptId, scheduled_task_titles: [], tasks: [] };
  }
}


