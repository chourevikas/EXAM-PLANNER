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

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
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
  attemptId: string,
  questionNumber: number,
  language: string = 'ENGLISH'
): Promise<QuestionNavResponse> {
  const url = `${API_BASE_URL}/attempts/${attemptId}/questions/${questionNumber}?language=${encodeURIComponent(language)}`;
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
  attemptId: string,
  payload: SaveResponseRequest
): Promise<SaveResponseResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/responses`, {
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
  attemptId: string,
  questionId: string
): Promise<RevealAnswerResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/reveal/${questionId}`, {
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
  attemptId: string,
  payload: HeartbeatRequest
): Promise<HeartbeatResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/heartbeat`, {
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
export async function getExamAttemptStatus(attemptId: string): Promise<ExamStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/status`, {
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
  attemptId: string,
  payload: SubmitExamRequest = { submission_reason: 'USER_CLICKED_SUBMIT' }
): Promise<SubmitExamResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/submit`, {
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
export async function getAttemptResult(attemptId: string): Promise<SubmitExamResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/result`, {
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
export async function getPsychometricReportJson(attemptId: string): Promise<PsychometricReport> {
  const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${attemptId}/json`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Psychometric report is not yet available or failed to compute.');
  }
  return data;
}

/** 10. Fetch Psychometric Diagnostic Report Markdown */
export async function getPsychometricReportMarkdown(attemptId: string): Promise<string> {
  const headers = getAuthHeaders();
  delete headers['Content-Type']; // Expect text/markdown

  const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${attemptId}/markdown`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: 'Failed to fetch markdown report' }));
    throw new Error(data.detail || 'Failed to fetch markdown report');
  }

  return await response.text();
}

export interface ExamItem {
  id: string;
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
export async function listExams(status?: string, includeInactive: boolean = false): Promise<ExamItem[]> {
  try {
    let url = `${API_BASE_URL}/exams`;
    if (status) {
      url += `?status=${encodeURIComponent(status)}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
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
  attempt_id: string;
  exam_id: string;
  exam_name: string;
  mode: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED' | 'EVALUATED' | string;
  total_score: number;
  max_possible_score: number;
  total_questions: number;
  started_at: string;
  submitted_at?: string;
}

/** 12. Fetch Candidate Attempts History */
export async function listCandidateAttempts(): Promise<AttemptHistoryItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/attempts`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.items || [];
  } catch (err) {
    console.warn('Failed to fetch candidate attempt history:', err);
    return [];
  }
}




export async function getAllAttemptQuestionsBulk(attemptId: string): Promise<any> {
  return { questions: [] };
}

export async function prefetchQuestion(attemptId: string, qNum: number, lang: string): Promise<void> {}

export async function saveQuestionResponsesBatch(attemptId: string, payload: any): Promise<any> {
  return { status: 'ACCEPTED' };
}

export async function getResponseBatchStatus(attemptId: string, batchId: string): Promise<any> {
  return { status: 'PROCESSED' };
}

export async function getAttemptUserProgressionReport(attemptId: string): Promise<any> { return null; }
export async function getAttemptEvaluationStatus(attemptId: string): Promise<any> { return null; }
export async function pollAttemptReportUntilReady(attemptId: string, onUpdate: (status: any) => void, maxRetries?: number, delay?: number): Promise<any> { return null; }
export async function getUserCumulativeAggregateReport(userId?: string): Promise<any> { return null; }
export async function getUserCumulativeAggregateMarkdown(userId?: string): Promise<string> { return ''; }
export async function getAttemptQuestionReport(attemptId: string): Promise<any> { return null; }
