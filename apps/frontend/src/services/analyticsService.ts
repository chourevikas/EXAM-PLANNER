import { guardedFetch } from '../utils/apiGuard';

const ANALYTICS_API_BASE_URL = '/api/v1/analytics';

export interface PredictedRankResponse {
  exam_code: string;
  exam_name: string;
  /** All null when the student hasn't answered anything yet (confidence_level INSUFFICIENT_DATA). */
  moving_average_score: number | null;
  predicted_percentile: number | null;
  top_percentage: number | null;
  predicted_rank: number | null;
  confidence_level: 'HIGH' | 'MEDIUM' | 'PROVISIONAL' | 'INSUFFICIENT_DATA';
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
  /** null for a month without submitted tests. */
  percentile: number | null;
  readiness_index: number | null;
  tests: number;
}

export interface SubjectBenchmark {
  subject: string;
  user_accuracy: number;
  /** Average across all students; null until the subject has enough answers platform-wide. */
  national_avg_accuracy: number | null;
  total_attempted: number;
}

export interface MonthlyBenchmarkResponse {
  period: string;
  predicted_rank: number | null;
  top_percentage: number | null;
  /** Students who started a test in the last 30 days. */
  active_aspirants: number;
  overall_percentile: number | null;
  /** Both null unless this month and last month each have tests. */
  previous_month_percentile: number | null;
  percentile_delta: number | null;
  readiness_index: number | null;
  readiness_status: string;
  confidence_level: 'HIGH' | 'MEDIUM' | 'PROVISIONAL' | 'INSUFFICIENT_DATA';
  attempts_analyzed: number;
  overall_accuracy: number | null;
  monthly_growth_curve: GrowthCurvePoint[];
  subject_benchmark: SubjectBenchmark[];
}

interface MonthlyBenchmarkCacheEntry {
  data: MonthlyBenchmarkResponse;
  timestamp: number;
}
const monthlyBenchmarkCache = new Map<string, MonthlyBenchmarkCacheEntry>();
const MONTHLY_BENCHMARK_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute client-side TTL

export async function fetchMonthlyBenchmark(
  overrideToken?: string,
  options?: { signal?: AbortSignal; forceRefresh?: boolean }
): Promise<MonthlyBenchmarkResponse> {
  const token = overrideToken || localStorage.getItem('access_token');
  const cacheKey = token ? token.slice(-16) : 'default';

  if (!options?.forceRefresh) {
    const cached = monthlyBenchmarkCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MONTHLY_BENCHMARK_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await guardedFetch(`${ANALYTICS_API_BASE_URL}/monthly-benchmark`, {
    headers,
    signal: options?.signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch monthly benchmarking analytics (Status ${res.status})`);
  }

  const data: MonthlyBenchmarkResponse = await res.json();
  monthlyBenchmarkCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export function invalidateMonthlyBenchmarkCache(): void {
  monthlyBenchmarkCache.clear();
}
