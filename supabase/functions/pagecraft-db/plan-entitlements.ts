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
  ownedSites: 1,
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

// Internal Pagecraft user ID. Auth identities, email aliases and paid-plan records can change.
export function isPlanExemptAccount(accountId?: string | null): boolean {
  return accountId === "328a15d0-0837-4881-8b47-38d316c03f95";
}

const unrestricted = Object.freeze({
  id: "unrestricted", label: "Unrestricted", ownedSites: null,
  storageBytes: Number.MAX_SAFE_INTEGER, public: false,
});

export function accountEntitlements(accountId: string | null | undefined, plan?: string | null) {
  return isPlanExemptAccount(accountId) ? unrestricted : planEntitlements(plan);
}
