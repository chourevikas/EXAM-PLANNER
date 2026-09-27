import { apiFetch } from './http';

const API_BASE = '/api/v1';

async function fetchJson(input: string, init?: RequestInit) {
  const res = await apiFetch(`${API_BASE}${input}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'API Error' }));
    throw new Error(err.detail || 'API Error');
  }
  return res.json();
}

// Plans
export interface SubscriptionPlan {
  id: number;
  plan_code: string;
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  billing_interval: string;
  display_order: number;
  is_active: boolean;
  metadata_json?: any;
  created_at?: string;
}

export const fetchPlans = async (): Promise<{ plans: SubscriptionPlan[] }> => {
  return fetchJson('/admin/plans?include_inactive=true');
};

export const createPlan = async (data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> => {
  return fetchJson('/admin/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updatePlan = async (id: number, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> => {
  return fetchJson(`/admin/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deactivatePlan = async (id: number): Promise<void> => {
  return fetchJson(`/admin/plans/${id}/deactivate`, { method: 'POST' });
};

export const reactivatePlan = async (id: number): Promise<void> => {
  return fetchJson(`/admin/plans/${id}/reactivate`, { method: 'POST' });
};

// Discounts
export interface DiscountOffer {
  id: number;
  name: string;
  description?: string;
  code?: string;
  discount_type: string;
  value: string;
  max_redemptions?: number;
  redemptions_used: number;
  max_redemptions_per_user?: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  is_public: boolean;
}

export const fetchDiscounts = async (): Promise<{ offers: DiscountOffer[] }> => {
  return fetchJson('/admin/discounts');
};

export const createDiscount = async (data: Partial<DiscountOffer>): Promise<DiscountOffer> => {
  return fetchJson('/admin/discounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const deactivateDiscount = async (id: number): Promise<void> => {
  return fetchJson(`/admin/discounts/${id}/deactivate`, { method: 'POST' });
};

// Grants
export const grantSubscription = async (userId: number | string, data: any): Promise<any> => {
  return fetchJson(`/admin/users/${userId}/subscription/grant`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const revokeSubscription = async (userId: number | string, data: any): Promise<any> => {
  return fetchJson(`/admin/users/${userId}/subscription/revoke`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const fetchUserSubscriptionHistory = async (userId: number): Promise<any> => {
  return fetchJson(`/admin/users/${userId}/subscription/history`);
};

// Audit Logs
export interface AuditLog {
  id: number;
  actor_admin_id?: number;
  action_type: string;
  target_user_id?: number;
  target_plan_id?: number;
  target_offer_id?: number;
  target_subscription_id?: number;
  action_metadata?: any;
  created_at: string;
}

export const fetchPremiumAuditLogs = async (): Promise<{ logs: AuditLog[], total: number }> => {
  return fetchJson('/admin/subscription/audit-logs');
};
