// Admin panel view id -> permission key (see backend ADMIN_SECTION_PERMISSIONS).
// `null` means every admin may open the view.
export const VIEW_PERMISSION: Record<string, string | null> = {
  dashboard: null,
  upload: 'admin.upload',
  'ai-queue': 'admin.upload',
  'exam-types': 'admin.exam_types',
  'exam-syllabus': 'admin.exam_types',
  review: 'admin.review',
  questions: 'admin.question_bank',
  'reported-questions': 'admin.reported_questions',
  feedback: 'admin.feedback',
  users: 'admin.users',
  'teacher-rewards': 'admin.teacher_rewards',
  'current-affairs': 'admin.current_affairs',
  notifications: 'admin.notifications',
  milestones: 'admin.milestones',
  translations: 'admin.translations',
  testimonials: 'admin.testimonials',
  analytics: 'admin.analytics',
  theme: 'admin.theme',
};

/**
 * Views an admin may open by navigation. Reported-questions admins can also open the review editor,
 * because "Edit question" on a report jumps there (the API allows it for the same reason).
 */
export function canOpenView(permissions: string[] | null | undefined, view: string): boolean {
  if (canAccessView(permissions, view)) return true;
  return view === 'review' && Array.isArray(permissions) && permissions.includes('admin.reported_questions');
}

/** `permissions` is null/undefined for unrestricted admins, otherwise the granted section keys. */
export function canAccessView(permissions: string[] | null | undefined, view: string): boolean {
  if (!Array.isArray(permissions)) return true;
  const required = VIEW_PERMISSION[view];
  if (required === undefined || required === null) return true;
  return permissions.includes(required);
}
