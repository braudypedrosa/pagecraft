export type AccountPlan = "free" | "pro";

export interface PlanEntitlements {
  id: AccountPlan;
  label: string;
  ownedSites: number | null;
  storageBytes: number;
  public: boolean;
}

export const FREE_PLAN: PlanEntitlements = Object.freeze({
  id: "free",
  label: "Free",
  ownedSites: 3,
  storageBytes: 100 * 1024 * 1024,
  public: true,
});

export const PRO_PLAN: PlanEntitlements = Object.freeze({
  id: "pro",
  label: "Pro",
  ownedSites: null,
  storageBytes: 5 * 1024 * 1024 * 1024,
  public: false,
});

export function planEntitlements(plan?: string | null): PlanEntitlements {
  return plan === "pro" ? PRO_PLAN : FREE_PLAN;
}
