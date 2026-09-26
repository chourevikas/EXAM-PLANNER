import { guardedFetch } from '../utils/apiGuard';

export interface PublicPlan {
  id: number;
  plan_code: string;
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  billing_interval: string;
  display_order: number;
}

export const fetchPublicPlans = async (): Promise<PublicPlan[]> => {
  const response = await fetch('/api/v1/plans');
  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }
  const data = await response.json();
  return data.plans;
};

export const validateDiscount = async (code: string, plan_id: number) => {
  const response = await guardedFetch('/api/v1/discounts/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, plan_id })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail?.message || 'Invalid promo code');
  }
  return await response.json();
};
