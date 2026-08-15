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
  BatchSaveItem,
  BatchSaveResponseRequest,
  BatchSaveResponseAck,
  BatchStatusResponse,
} from '../types/exam';

const API_BASE_URL = '/api/v1';

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Client-Side In-Memory Cache for Zero-Lag Question Switching
const questionCache = new Map<string, QuestionNavResponse>();
const solutionCache = new Map<string, any>();

export function clearExamClientCache() {
  questionCache.clear();
  solutionCache.clear();
}

/** Format Canonical Exam Title for UI Display */
export function formatCanonicalExamTitle(exam: {
  name?: string;
  code?: string;
  source_year?: number | string;
  stage?: string;
  subject_code?: string;
  paper_set_code?: string;
}): string {
  const rawName = (exam.name || exam.code || 'UPSC Exam').replace(/[-_]/g, ' ').toUpperCase();
  const year = exam.source_year ? `${exam.source_year}` : '';
  const stage = exam.stage ? exam.stage.toUpperCase() : 'PRELIMS';
  const rawSet = exam.paper_set_code ? exam.paper_set_code.toUpperCase().replace('SET_', 'Set ') : 'Set A';
  const paper = exam.subject_code ? exam.subject_code.toUpperCase().replace('_', '-') : 'GS-1';

  // Avoid repetitive tokens if name already contains year/stage
  let title = rawName;
  if (!title.includes(year) && year) title += ` (${year})`;
  if (!title.includes(stage) && stage) title += ` • ${stage}`;
  if (!title.includes(paper) && paper) title += ` • ${paper}`;
  if (!title.includes(rawSet) && rawSet) title += ` • ${rawSet}`;
  return title;
}

/** Format Canonical Question Title for UI Display */
export function formatCanonicalQuestionTitle(
  examNameOrCode: string,
  year?: number | string,
  setCode?: string,
  questionNumber?: number
): string {
  const cleanName = (examNameOrCode || 'UPSC').replace(/[-_]/g, ' ').trim();
  const yearStr = year ? ` ${year}` : '';
  const setStr = setCode ? ` (${setCode.toUpperCase().replace('SET_', 'Set ')})` : '';
  const qStr = questionNumber !== undefined ? ` • Q.${questionNumber}` : '';
  return `${cleanName}${yearStr}${setStr}${qStr}`;
}

/** Upload Question Paper PDF to Pipeline 1 */
export async function uploadExamPaper({
  examName,
  year,
  paperType,
  set_code = 'SET_A',
  file,
  conflict_resolution = 'CHECK',
}: UploadExamPayload & { set_code?: string; conflict_resolution?: string }): Promise<UploadExamResponse> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const formData = new FormData();
  formData.append('exam_name', examName || 'UPSC');
  formData.append('year', year);
  formData.append('stage', 'prelims');
  formData.append('exam_type', paperType || 'PYQ');
  formData.append('total_questions', '100');
  formData.append('set_code', set_code || 'SET_A');
  formData.append('conflict_resolution', conflict_resolution || 'CHECK');
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/pipeline/upload-question-paper`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const text = await response.text();
  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    result = { detail: text || 'Server error occurred during question paper upload.' };
  }

  if (!response.ok) {
    const error: any = new Error(result.message || result.detail || 'Question Paper upload failed.');
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result;
}

/** Upload Answer Key PDF to Pipeline 2 */
export async function uploadAnswerKey({
  examName,
  year,
  set_code = 'SET_A',
  file,
  conflict_resolution = 'CHECK',
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
  formData.append('exam_name', examName || 'UPSC');
  formData.append('year', year);
  formData.append('stage', 'prelims');
  formData.append('exam_type', 'PYQ');
  formData.append('total_questions', '100');
  formData.append('set_code', set_code || 'SET_A');
  formData.append('conflict_resolution', conflict_resolution || 'CHECK');
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/pipeline/upload-answer-key`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const text = await response.text();
  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    result = { detail: text || 'Server error occurred during Answer Key upload.' };
  }

  if (!response.ok) {
    const error: any = new Error(result.message || result.detail || 'Answer Key upload failed.');
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result;
}

/** 1. Start Exam Attempt */
export async function startExamAttempt(payload: StartExamRequest): Promise<StartExamResponse> {
  clearExamClientCache();
  const response = await fetch(`${API_BASE_URL}/attempts/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to start exam session.');
  }

  // Pre-seed first question in cache
  if (data.first_question) {
    const cacheKey = `${data.attempt_id}_1_ENGLISH`;
    questionCache.set(cacheKey, data.first_question);
  }

  const populateQuestionCache = (doc: any) => {
    const qList = doc.questions || [];
    const total = qList.length || data.total_questions;
    qList.forEach((qItem: any, idx: number) => {
      const qNum = qItem.question_number || idx + 1;
      const qNav: QuestionNavResponse = {
        question: qItem,
        navigation: {
          current: qNum,
          total: total,
          has_next: qNum < total,
          has_prev: qNum > 1,
        },
        response_state: {
          selected_option_id: null,
          is_marked_for_review: false,
          time_spent_seconds: 0,
          question_status: idx === 0 ? 'VISITED' : 'UNVISITED',
          answer_revealed: false,
        },
      };
      const engKey = `${data.attempt_id}_${qNum}_ENGLISH`;
      if (!questionCache.has(engKey) || qNum !== 1) {
        questionCache.set(engKey, qNav);
      }
    });
    console.info(
      `%c[ExamService:BULK_PRELOAD_SUCCESS] Preloaded ${qList.length} questions into memory cache`,
      'color: #10b981; font-weight: bold;'
    );
  };

  // Helper to fallback to backend bulk endpoint
  const fallbackToBackendBulk = () => {
    fetch(`${API_BASE_URL}/attempts/${data.attempt_id}/questions/bulk`, {
      headers: getAuthHeaders(),
    })
      .then(async (res) => {
        if (res.ok) {
          const doc = await res.json();
          populateQuestionCache(doc);
        }
      })
      .catch((err) => {
        console.warn('[ExamService:BULK_FALLBACK_WARN] Bulk fallback failed:', err);
      });
  };

  // Pre-load all questions in background via presigned URL or backend bulk endpoint
  if (data.questions_presigned_url) {
    fetch(data.questions_presigned_url)
      .then(async (res) => {
        if (res.ok) {
          const doc = await res.json();
          populateQuestionCache(doc);
        } else {
          fallbackToBackendBulk();
        }
      })
      .catch(() => {
        fallbackToBackendBulk();
      });
  } else {
    fallbackToBackendBulk();
  }

  return data;
}

/** 2. Fetch Question with Client-Side In-Memory Caching */
export async function getQuestionByNumber(
  attemptId: string,
  questionNumber: number,
  language: string = 'ENGLISH',
  skipCache: boolean = false
): Promise<QuestionNavResponse> {
  const cacheKey = `${attemptId}_${questionNumber}_${language.toUpperCase()}`;
  if (!skipCache && questionCache.has(cacheKey)) {
    return questionCache.get(cacheKey)!;
  }

  const url = `${API_BASE_URL}/attempts/${attemptId}/questions/${questionNumber}?language=${encodeURIComponent(language)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Failed parsing question data: ${text}`);
  }

  if (!response.ok) {
    throw new Error(data.detail || `Failed to fetch question #${questionNumber}.`);
  }

  questionCache.set(cacheKey, data);
  return data;
}

/** 3. Automatically Prefetch Next Question in Background */
export async function prefetchQuestion(
  attemptId: string,
  questionNumber: number,
  language: string = 'ENGLISH'
): Promise<void> {
  const cacheKey = `${attemptId}_${questionNumber}_${language.toUpperCase()}`;
  if (questionCache.has(cacheKey)) return;

  try {
    const url = `${API_BASE_URL}/attempts/${attemptId}/questions/${questionNumber}?language=${encodeURIComponent(language)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      questionCache.set(cacheKey, data);
    }
  } catch {
    // Background prefetch error is non-fatal
  }
}

/** 4. Save Question Response Telemetry */
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
    throw new Error(data.detail || 'Failed to save response.');
  }

  // Update cached state if present
  for (const [key, cached] of questionCache.entries()) {
    if (key.startsWith(attemptId) && cached.question.question_id === payload.question_id) {
      cached.response_state.selected_option_id = payload.selected_option_id ?? null;
      cached.response_state.is_marked_for_review = Boolean(payload.is_marked_for_review);
    }
  }

  return data;
}

/** 4b. Save Batch of Question Responses Asynchronously with Zero-Lag & Retry Verification */
export async function saveQuestionResponsesBatch(
  attemptId: string,
  payload: BatchSaveResponseRequest
): Promise<BatchSaveResponseAck> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/responses/batch`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to persist response batch.');
  }

  // Update cached state for all items in batch
  for (const item of payload.responses) {
    for (const [key, cached] of questionCache.entries()) {
      if (key.startsWith(attemptId) && cached.question.question_id === item.question_id) {
        cached.response_state.selected_option_id = item.selected_option_id ?? null;
        cached.response_state.is_marked_for_review = Boolean(item.is_marked_for_review);
      }
    }
  }

  return data;
}

/** 4c. Verify Batch Processing Status */
export async function getResponseBatchStatus(
  attemptId: string,
  batchId: string
): Promise<BatchStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/responses/batch/${batchId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to fetch batch status.');
  }
  return data;
}

/** 5. Reveal Answer with Solution Caching */
export async function revealQuestionAnswer(
  attemptId: string,
  questionId: string
): Promise<RevealAnswerResponse> {
  const cacheKey = `${attemptId}_reveal_${questionId}`;
  if (solutionCache.has(cacheKey)) {
    return solutionCache.get(cacheKey);
  }

  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/reveal/${questionId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Answer reveal is not permitted in EXAM mode.');
  }

  solutionCache.set(cacheKey, data);
  return data;
}

/** 6. Periodic Heartbeat Sync */
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
    throw new Error(data.detail || 'Heartbeat sync failed.');
  }
  return data;
}

/** 7. Get Full Exam Attempt Status */
export async function getExamAttemptStatus(attemptId: string): Promise<ExamStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/attempts/${attemptId}/status`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to resume exam session.');
  }
  return data;
}

/** 8. Submit Exam Attempt */
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

/** 9. Get Submitted Attempt Summary Result */
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

/** 10. Fetch Psychometric Diagnostic Report JSON with Safe Error Handling */
export async function getPsychometricReportJson(attemptId: string): Promise<PsychometricReport> {
  const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${attemptId}/json`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Invalid report format received from server. ${text.slice(0, 100)}...`
    );
  }

  if (!response.ok) {
    throw new Error(data.detail || 'Psychometric report is not yet available or failed to compute.');
  }
  return data;
}

/** 11. Fetch Psychometric Diagnostic Report Markdown */
export async function getPsychometricReportMarkdown(attemptId: string): Promise<string> {
  const headers = getAuthHeaders();
  delete headers['Content-Type'];

  const response = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${attemptId}/markdown`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = 'Failed to fetch markdown report';
    try {
      const data = JSON.parse(text);
      detail = data.detail || detail;
    } catch {
      detail = text || detail;
    }
    throw new Error(detail);
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

/** 12. Fetch All Available Registered Exams (Optionally filtered by is_active) */
export async function listExams(status?: string, isActive?: boolean): Promise<ExamItem[]> {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (isActive !== undefined) params.append('is_active', String(isActive));

    const url = `${API_BASE_URL}/exams${params.toString() ? `?${params.toString()}` : ''}`;
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

/** 13. Fetch Candidate Attempts History */
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

/** 14. Fetch Question Directly from Database Fallback Endpoint */
export async function getQuestionFromDbFallback(examId: string, questionNumber: number): Promise<any> {
  console.info(`%c[ExamService:DB_FALLBACK] Requesting Question #${questionNumber} from PostgreSQL endpoint for Exam ${examId}`, 'color: #f59e0b; font-weight: bold;');
  const res = await fetch(`${API_BASE_URL}/exams/${examId}/question-db/${questionNumber}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    console.error(`[ExamService:DB_FALLBACK_FAILED] Failed to fetch question #${questionNumber} from DB fallback.`);
    throw new Error(`Failed to fetch question #${questionNumber} from database fallback.`);
  }
  const payload = await res.json();
  console.info(`%c[ExamService:DB_FALLBACK_SUCCESS] Retrieved Question #${questionNumber} from DB fallback.`, 'color: #10b981; font-weight: bold;', payload.data);
  return payload.data;
}

/** 15. Fetch Solution Directly from Database Fallback Endpoint */
export async function getSolutionFromDbFallback(examId: string, questionNumber: number): Promise<any> {
  console.info(`%c[ExamService:DB_FALLBACK] Requesting Solution #${questionNumber} from PostgreSQL endpoint for Exam ${examId}`, 'color: #f59e0b; font-weight: bold;');
  const res = await fetch(`${API_BASE_URL}/exams/${examId}/solution-db/${questionNumber}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    console.error(`[ExamService:DB_FALLBACK_FAILED] Failed to fetch solution #${questionNumber} from DB fallback.`);
    throw new Error(`Failed to fetch solution #${questionNumber} from database fallback.`);
  }
  const payload = await res.json();
  console.info(`%c[ExamService:DB_FALLBACK_SUCCESS] Retrieved Solution #${questionNumber} from DB fallback.`, 'color: #10b981; font-weight: bold;', payload.data);
  return payload.data;
}

/** 16. Fetch Question JSON Artifact using S3 Presigned URL with Dedicated DB Fallback & In-Memory Cache */
export async function getQuestionArtifact(examId: string, questionNumber: number): Promise<any> {
  const cacheKey = `artifact_q_${examId}_${questionNumber}`;
  if (questionCache.has(cacheKey)) {
    console.info(`%c[ExamService:CACHE_HIT] Serving Question #${questionNumber} from in-memory cache.`, 'color: #3b82f6;');
    return questionCache.get(cacheKey);
  }

  let questionData: any = null;

  try {
    console.info(`[ExamService:S3_LOOKUP] Fetching S3 presigned URL for question #${questionNumber}...`);
    const res = await fetch(`${API_BASE_URL}/exams/${examId}/question-artifact/${questionNumber}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload.presigned_url) {
        console.info(`%c[ExamService:S3_FETCH] Fetching direct static JSON from S3 presigned URL for Q#${questionNumber}`, 'color: #8b5cf6;', payload.presigned_url);
        const s3Res = await fetch(payload.presigned_url);
        if (s3Res.ok) {
          questionData = await s3Res.json();
          console.info(`%c[ExamService:S3_SUCCESS] Direct S3 download succeeded for Q#${questionNumber}`, 'color: #10b981; font-weight: bold;');
        } else {
          console.warn(`[ExamService:S3_HTTP_ERROR] S3 returned HTTP ${s3Res.status} for Q#${questionNumber}`);
        }
      }
    } else {
      console.warn(`[ExamService:S3_BACKEND_MISS] Backend reported question #${questionNumber} artifact not in S3`);
    }
  } catch (err) {
    console.warn(`[ExamService:S3_ERROR] S3 Presigned fetch failed for question #${questionNumber}, initiating DB fallback:`, err);
  }

  // If S3 presigned fetch was not successful, call the dedicated DB fallback endpoint
  if (!questionData) {
    console.info(`%c[ExamService:INITIATING_DB_FALLBACK] Falling back to dedicated database endpoint for Q#${questionNumber}`, 'color: #f59e0b; font-weight: bold;');
    questionData = await getQuestionFromDbFallback(examId, questionNumber);
  }

  if (questionData) {
    questionCache.set(cacheKey, questionData);
  }
  return questionData;
}

/** 17. Fetch Solution JSON Artifact using S3 Presigned URL with Dedicated DB Fallback & In-Memory Cache */
export async function getSolutionArtifact(examId: string, questionNumber: number): Promise<any> {
  const cacheKey = `artifact_sol_${examId}_${questionNumber}`;
  if (solutionCache.has(cacheKey)) {
    console.info(`%c[ExamService:CACHE_HIT] Serving Solution #${questionNumber} from in-memory cache.`, 'color: #3b82f6;');
    return solutionCache.get(cacheKey);
  }

  let solData: any = null;

  try {
    console.info(`[ExamService:S3_LOOKUP] Fetching S3 presigned URL for solution #${questionNumber}...`);
    const res = await fetch(`${API_BASE_URL}/exams/${examId}/solution-artifact/${questionNumber}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload.presigned_url) {
        console.info(`%c[ExamService:S3_FETCH] Fetching direct static JSON from S3 presigned URL for Solution #${questionNumber}`, 'color: #8b5cf6;', payload.presigned_url);
        const s3Res = await fetch(payload.presigned_url);
        if (s3Res.ok) {
          solData = await s3Res.json();
          console.info(`%c[ExamService:S3_SUCCESS] Direct S3 solution download succeeded for Q#${questionNumber}`, 'color: #10b981; font-weight: bold;');
        } else {
          console.warn(`[ExamService:S3_HTTP_ERROR] S3 returned HTTP ${s3Res.status} for Solution #${questionNumber}`);
        }
      }
    } else {
      console.warn(`[ExamService:S3_BACKEND_MISS] Backend reported solution #${questionNumber} artifact not in S3`);
    }
  } catch (err) {
    console.warn(`[ExamService:S3_ERROR] S3 Presigned fetch failed for solution #${questionNumber}, initiating DB fallback:`, err);
  }

  // If S3 fetch was not successful, call the dedicated DB fallback endpoint
  if (!solData) {
    console.info(`%c[ExamService:INITIATING_DB_FALLBACK] Falling back to dedicated database endpoint for Solution #${questionNumber}`, 'color: #f59e0b; font-weight: bold;');
    solData = await getSolutionFromDbFallback(examId, questionNumber);
  }

  if (solData) {
    solutionCache.set(cacheKey, solData);
  }
  return solData;
}

/** 18. Fetch Report 1: Question-Level Detailed Diagnostic & Explanations */
export async function getAttemptQuestionReport(attemptId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${attemptId}/questions`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch question-level diagnostic report.');
  }
  return await res.json();
}

/** 19. Fetch Report 2: Exam-Level 12-Matrix Aggregated Report */
export async function getAttemptExamReport(attemptId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${attemptId}/exam`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch exam-level 12-matrix report.');
  }
  return await res.json();
}

/** 20. Fetch Report 3: Cumulative User Skill Progression Delta Report */
export async function getAttemptUserProgressionReport(attemptId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/analytics/reports/attempts/${attemptId}/user-delta`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user skill progression delta report.');
  }
  return await res.json();
}

/** 21. Fetch User Cumulative Skill Profile (All 12 Matrices Aggregate) */
export async function getUserCumulativeSkillProfile(userId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/analytics/reports/user/${userId}/skill-profile`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user cumulative skill profile.');
  }
  return await res.json();
}


