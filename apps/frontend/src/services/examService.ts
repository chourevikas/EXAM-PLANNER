import { UploadExamPayload, UploadExamResponse } from '../types/exam';

const API_BASE_URL = '';

export async function uploadExamPaper({
  examName,
  year,
  paperType,
  file,
}: UploadExamPayload): Promise<UploadExamResponse> {
  const token = localStorage.getItem('access_token');

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const formData = new FormData();
  formData.append('exam_name', examName);
  formData.append('year', year);
  formData.append('paper_type', paperType);
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
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
