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
  free_questions_attempted?: number;
  current_streak?: number;
  total_xp?: number;
  level?: number;
  student_profile?: StudentProfile;
  admin_profile?: AdminProfile;
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
}
