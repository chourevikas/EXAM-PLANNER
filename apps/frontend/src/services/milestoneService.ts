import { guardedFetch } from '../utils/apiGuard';

export type MilestoneCriteria = 'QUESTIONS_SOLVED' | 'CORRECT_ANSWERS' | 'TESTS_COMPLETED' | 'STREAK_DAYS' | 'XP_EARNED';

export interface Milestone {
  id: number;
  name: string;
  description: string;
  criteria_type: MilestoneCriteria;
  criteria_label: string;
  threshold: number;
  xp_reward: number;
  is_active: boolean;
  unlocked_count: number;
}

export type MilestoneInput = Pick<Milestone, 'name' | 'description' | 'criteria_type' | 'threshold' | 'xp_reward' | 'is_active'>;

const BASE = '/api/v1/admin/milestones';

function headers(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, '');
  return fallback;
}

export async function listMilestones(): Promise<{ criteria: Record<MilestoneCriteria, string>; milestones: Milestone[] }> {
  const res = await guardedFetch(BASE, { headers: headers() });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not load milestones'));
  return res.json();
}

export async function saveMilestone(input: MilestoneInput, id?: number): Promise<Milestone> {
  const res = await guardedFetch(id ? `${BASE}/${id}` : BASE, {
    method: id ? 'PUT' : 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not save the milestone'));
  return res.json();
}

export async function deleteMilestone(id: number): Promise<void> {
  const res = await guardedFetch(`${BASE}/${id}`, { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not delete the milestone'));
}
