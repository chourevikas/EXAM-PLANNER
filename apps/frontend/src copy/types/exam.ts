export type ExamName = 'upsc' | 'mppsc' | 'mpsc';

export type PaperType = 'previous_year_question' | 'mock_test';

export type AdminTab = 'upload' | 'overview' | 'bank';

export interface UploadExamPayload {
  examName: string;
  year: string;
  paperType: string;
  file: File;
}

export interface UploadExamResponse {
  message?: string;
  s3_path?: string;
  detail?: string;
}

export interface StatusMessage {
  text: string;
  isError: boolean;
}
