import { apiFetch, errorMessage } from './http';

export type MetricsRange = '7d' | '30d' | '90d' | '365d';

export interface RevenueMetrics {
  currency: string;
  range_days: number;
  revenue: number;
  previous_revenue: number;
  mrr: number;
  new_paid_subscriptions: number;
  paying_students: number;
  average_revenue_per_paying_student: number;
  discounts_given: number;
  ended_subscriptions: number;
  pro_students: number;
  active_subscriptions_by_source: { PAYMENT: number; ADMIN_GRANT: number; PROMO: number };
  paid_conversion_percent: number;
  monthly: { month: string; revenue: number }[];
  by_plan: { plan: string; subscriptions: number; revenue: number }[];
}

export interface EngagementDay {
  date: string;
  active_students: number;
  new_students: number;
  questions: number;
  tests: number;
}

export interface EngagementMetrics {
  range_days: number;
  total_students: number;
  new_students: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  active_in_range: number;
  stickiness_percent: number;
  returning_percent: number | null;
  questions_answered: number;
  tests_completed: number;
  subject_wise_tests: number;
  questions_per_active_student: number;
  free_students_hit_limit: number;
  milestones_unlocked: number;
  weekly_email_subscribers: number;
  test_languages: { en: number; hi: number; mr: number };
  top_exams: { exam: string; tests: number }[];
  daily: EngagementDay[];
}

export interface BusinessMetrics {
  range: MetricsRange;
  generated_at: string;
  revenue: RevenueMetrics;
  engagement: EngagementMetrics;
}

export async function fetchBusinessMetrics(range: MetricsRange): Promise<BusinessMetrics> {
  const res = await apiFetch(`/api/v1/admin/business-metrics?range=${range}`);
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not load revenue and engagement.'));
  return res.json();
}
