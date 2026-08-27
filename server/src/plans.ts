import type { AccountPlan } from './auth.ts';

export interface PlanEntitlements {
  id: AccountPlan;
  label: string;
  ownedSites: number;
  storageBytes: number;
}

export const FREE_PLAN: PlanEntitlements = Object.freeze({
  id: 'free',
  label: 'Free',
  ownedSites: 3,
  storageBytes: 100 * 1024 * 1024
});

export const planEntitlements = (_plan: AccountPlan = 'free') => FREE_PLAN;
