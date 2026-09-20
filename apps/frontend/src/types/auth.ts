export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  TEACHER = 'TEACHER',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

export interface StudentProfile {
  subscription_tier: string;
  free_questions_attempted: number;
  current_streak: number;
  highest_streak: number;
  total_xp: number;
  level: number;
}

export interface AdminProfile {
  organization_name?: string;
  department?: string;
  approved_at?: string;
  rejection_reason?: string;
}

export interface User {
  id: number | string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  profile_image?: string;
  is_verified?: boolean;
  timezone?: string;
  subscription_tier?: string;
  phone?: string | null;
  subscription_ends_at?: string | null;
  subscription_days_remaining?: number | null;
  admin_permissions?: string[] | null;
  // Exam-preparation details the student saved on their profile.
  target_exam?: string | null;
  target_year?: string | null;
  optional_subject?: string | null;
  weekly_hours?: string | null;
  // Self-rated 1-5 per subject, captured during first-login onboarding.
  subject_proficiency?: Record<string, number> | null;
  // False until a student completes onboarding; undefined on sessions older than the feature.
  onboarding_completed?: boolean;
  free_questions_attempted?: number;
  current_streak?: number;
  total_xp?: number;
  level?: number;
  student_profile?: StudentProfile;
  admin_profile?: AdminProfile;
  preferred_language?: string;
  created_at: string;
  updated_at?: string;
}


export interface AuthResponse {
  access_token?: string;
  token_type?: string;
  user?: User;
  redirect_url?: string;
  is_pending_approval?: boolean;
  message?: string;
}

export interface AdminApprovalRequest {
  id: number | string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  organization_name?: string;
  department?: string;
  created_at: string;
}

export interface AdminApprovalLog {
  id: number | string;
  admin_user_name: string;
  admin_user_email: string;
  action: 'APPROVED' | 'REJECTED';
  reviewed_by_name: string;
  reason?: string;
  created_at: string;
}

export interface SystemStats {
  pending_admins_count: number;
  active_admins_count: number;
  active_students_count: number;
  rejected_admins_count: number;
  aws_rds_status: string;
  database_name: string;
  db_host: string;
}

export interface UserDirectoryItem {
  id: number | string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  organization_name?: string;
  department?: string;
  target_exam?: string;
  target_year?: string;
  created_at: string;
  suspended_at?: string;
  updated_at?: string;
  custom_role_id?: number | null;
}

export interface Permission {
  id: number;
  key: string;
  label: string;
  description?: string;
}

export interface Role {
  id: number;
  name: string;
  slug: string;
  base_role_type: UserRole;
  is_system: boolean;
  description?: string;
  permission_keys: string[];
  created_at: string;
  updated_at: string;
}

export interface ReviewPointsLogEntry {
  id: number;
  action: 'APPROVE' | 'REJECT';
  points: number;
  question_id?: number | null;
  created_at: string;
}

export interface TeacherPointsSummary {
  total_review_points: number;
  reviews_completed_count: number;
  recent_logs: ReviewPointsLogEntry[];
}

export interface TeacherReward {
  id: number;
  teacher_id: number;
  admin_id?: number | null;
  title: string;
  description?: string;
  points_value?: number | null;
  created_at: string;
}

export interface TeacherLeaderboardEntry {
  teacher_id: number;
  full_name: string;
  email: string;
  total_review_points: number;
  reviews_completed_count: number;
}

export interface HumanReviewTaskSummary {
  id: number;
  question_id: number;
  exam_id: number;
  review_status: string;
  is_flagged_by_validator: boolean;
  reviewer_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}
