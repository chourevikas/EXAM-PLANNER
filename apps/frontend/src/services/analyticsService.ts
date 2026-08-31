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
