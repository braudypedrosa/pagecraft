export type AccountPlan = "free" | "launch" | "studio" | "pro";
export type PaidPlan = Exclude<AccountPlan, "free">;
export type PlanSource = "free" | "subscription" | "grant";

export interface PlanEntitlements {
  id: AccountPlan;
  label: string;
  ownedSites: number | null;
  storageBytes: number;
  public: boolean;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const FREE_PLAN: PlanEntitlements = Object.freeze({
  id: "free",
  label: "Free",
  ownedSites: 1,
  storageBytes: 100 * MB,
  public: true,
});

/* Launch and Studio follow docs/billing-and-launch-guide.md. They stay non-public until
   checkout ships; until then they are reachable only through a trusted plan grant. The
   storage allowances are working figures pending the final price catalog. */
export const LAUNCH_PLAN: PlanEntitlements = Object.freeze({
  id: "launch",
  label: "Launch",
  ownedSites: 5,
  storageBytes: 1 * GB,
  public: false,
});

export const STUDIO_PLAN: PlanEntitlements = Object.freeze({
  id: "studio",
  label: "Studio",
  ownedSites: 20,
  storageBytes: 5 * GB,
  public: false,
});

export const PRO_PLAN: PlanEntitlements = Object.freeze({
  id: "pro",
  label: "Pro",
  ownedSites: null,
  storageBytes: 5 * GB,
  public: false,
});

const CATALOG: Readonly<Record<AccountPlan, PlanEntitlements>> = Object.freeze({
  free: FREE_PLAN,
  launch: LAUNCH_PLAN,
  studio: STUDIO_PLAN,
  pro: PRO_PLAN,
});

/** Higher rank wins when an account holds more than one entitlement. */
export const PLAN_RANK: Readonly<Record<AccountPlan, number>> = Object.freeze({
  free: 0,
  launch: 1,
  studio: 2,
  pro: 3,
});

export const PAID_PLANS: readonly PaidPlan[] = Object.freeze(["launch", "studio", "pro"]);

export const isPaidPlan = (value: unknown): value is PaidPlan =>
  typeof value === "string" && (PAID_PLANS as readonly string[]).includes(value);

/** Unknown or missing values fail closed to Free. */
export function planEntitlements(plan?: string | null): PlanEntitlements {
  return plan && Object.hasOwn(CATALOG, plan) ? CATALOG[plan as AccountPlan] : FREE_PLAN;
}

/** Days a past-due subscription keeps its plan while Paddle retries the payment. */
export const PAST_DUE_GRACE_DAYS = 7;

export interface PlanGrantState {
  plan: string;
  expiresAt?: string | Date | null;
  revokedAt?: string | Date | null;
}

export interface SubscriptionState {
  plan: string;
  status: string;
  /** When the subscription entered its current status. */
  statusChangedAt?: string | Date | null;
}

export interface EffectivePlan {
  plan: AccountPlan;
  source: PlanSource;
}

const time = (value: string | Date | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const grantActive = (grant: PlanGrantState, now: number) => {
  if (!isPaidPlan(grant.plan) || grant.revokedAt) return false;
  const expires = time(grant.expiresAt);
  return expires === null || expires > now;
};

const subscriptionActive = (subscription: SubscriptionState, now: number) => {
  if (!isPaidPlan(subscription.plan)) return false;
  if (subscription.status === "active" || subscription.status === "trialing") return true;
  if (subscription.status !== "past_due") return false;
  const since = time(subscription.statusChangedAt);
  return since !== null && now < since + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
};

/* The one rule that turns billing state into an account level: the highest of every active
   grant and every subscription that is active, trialing, or past due within the grace window.
   On a tie a subscription wins, so support can see that the customer is paying. */
export function effectivePlan(input: {
  grants?: readonly PlanGrantState[];
  subscriptions?: readonly SubscriptionState[];
  now?: Date;
}): EffectivePlan {
  const now = (input.now ?? new Date()).getTime();
  let best: EffectivePlan = { plan: "free", source: "free" };
  const consider = (plan: PaidPlan, source: PlanSource) => {
    if (
      PLAN_RANK[plan] > PLAN_RANK[best.plan] ||
      (PLAN_RANK[plan] === PLAN_RANK[best.plan] && source === "subscription" && best.source === "grant")
    ) best = { plan, source };
  };
  for (const subscription of input.subscriptions ?? []) {
    if (subscriptionActive(subscription, now)) consider(subscription.plan as PaidPlan, "subscription");
  }
  for (const grant of input.grants ?? []) {
    if (grantActive(grant, now)) consider(grant.plan as PaidPlan, "grant");
  }
  return best;
}
