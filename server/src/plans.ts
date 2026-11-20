/* Node and the database gateway use the same entitlement catalog. Plans are assigned in
   Pagecraft's protected user record, never by a browser or editable Auth metadata. The stored
   value is derived from plan grants and billing subscriptions by `effectivePlan`. */
export {
  FREE_PLAN, LAUNCH_PLAN, STUDIO_PLAN, PRO_PLAN, PLAN_RANK, PAID_PLANS, PAST_DUE_GRACE_DAYS,
  planEntitlements, accountEntitlements, isPlanExemptAccount, effectivePlan, isPaidPlan,
  type AccountPlan, type PaidPlan, type PlanSource, type PlanEntitlements,
  type PlanGrantState, type SubscriptionState, type EffectivePlan,
} from '../../supabase/functions/pagecraft-db/plan-entitlements.ts';
