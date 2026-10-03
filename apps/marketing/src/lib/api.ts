// Server-side client for the FastAPI backend. In Docker this is the internal service URL.
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

export interface CurrentAffair {
  id: number;
  title: string;
  content: string;
  topic: string | null;
  subtopic: string | null;
  date: string;
  updated_at: string;
}

export interface CurrentAffairPage {
  items: CurrentAffair[];
  total: number;
  page: number;
  size: number;
}

export interface Plan {
  id: number;
  plan_code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  metadata_json: { features?: string[]; [k: string]: unknown } | null;
}

export class NotFoundError extends Error {}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, { signal: AbortSignal.timeout(8000) });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// Small in-process TTL cache so crawler bursts don't hammer the API.
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const FIVE_MIN = 5 * 60 * 1000;

export const api = {
  currentAffairs: (page = 1, size = 20) =>
    cached(`ca:${page}:${size}`, FIVE_MIN, () =>
      get<CurrentAffairPage>(`/public/current-affairs?page=${page}&size=${size}`),
    ),
  currentAffair: (id: number) =>
    cached(`ca:${id}`, FIVE_MIN, () => get<CurrentAffair>(`/public/current-affairs/${id}`)),
  plans: () => cached('plans', FIVE_MIN, () => get<{ plans: Plan[] }>('/plans').then((r) => r.plans)),
};
