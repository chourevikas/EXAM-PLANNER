import { guardedFetch } from '../utils/apiGuard';

const ANALYTICS_API_BASE_URL = '/api/v1/analytics';

export interface PredictedRankResponse {
  exam_code: string;
  exam_name: string;
  moving_average_score: number;
  predicted_percentile: number;
  top_percentage: number;
  predicted_rank: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'PROVISIONAL';
  total_candidates: number;
  attempts_analyzed: number;
}

export async function fetchPredictedRank(): Promise<PredictedRankResponse> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await guardedFetch(`${ANALYTICS_API_BASE_URL}/predicted-rank`, { headers });
  if (!res.ok) {
    throw new Error('Failed to fetch predicted rank analytics');
  }

  return await res.json();
}

export interface GrowthCurvePoint {
  month: string;
  percentile: number;
  readiness_index: number;
}

export interface SubjectBenchmark {
  subject: string;
  user_accuracy: number;
  national_avg_accuracy: number;
  total_attempted: number;
}

export interface MonthlyBenchmarkResponse {
  period: string;
  predicted_rank: number;
  top_percentage: number;
  active_aspirants: number;
  overall_percentile: number;
  previous_month_percentile: number;
  percentile_delta: number;
  readiness_index: number;
  readiness_status: string;
  confidence_level: 'HIGH' | 'MEDIUM' | 'PROVISIONAL';
  attempts_analyzed: number;
  overall_accuracy: number;
  monthly_growth_curve: GrowthCurvePoint[];
  subject_benchmark: SubjectBenchmark[];
}

export async function fetchMonthlyBenchmark(overrideToken?: string): Promise<MonthlyBenchmarkResponse> {
  const token = overrideToken || localStorage.getItem('access_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await guardedFetch(`${ANALYTICS_API_BASE_URL}/monthly-benchmark`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch monthly benchmarking analytics (Status ${res.status})`);
  }

  return await res.json();
}
