export interface ExamType {
  id: number;
  type: string;
  name: string;
  total_duration: number;
  number_of_questions: number;
  total_marks: number;
  negative_marks: number;
  positive_marks: number;
  description?: string | null;
  is_active: boolean;
  exams_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ExamTypeCreatePayload {
  type: string;
  name: string;
  total_duration: number;
  number_of_questions: number;
  total_marks: number;
  negative_marks: number;
  positive_marks: number;
  description?: string;
  is_active?: boolean;
}

export interface ExamTypeUpdatePayload {
  name?: string;
  total_duration?: number;
  number_of_questions?: number;
  total_marks?: number;
  negative_marks?: number;
  positive_marks?: number;
  description?: string;
  is_active?: boolean;
}
