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

  const res = await fetch(`${ANALYTICS_API_BASE_URL}/predicted-rank`, { headers });
  if (!res.ok) {
    throw new Error('Failed to fetch predicted rank analytics');
  }

  return await res.json();
}
