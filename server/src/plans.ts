/* Node and the database gateway use the same entitlement catalog. Plans are assigned in
   Pagecraft's protected user record, never by a browser or editable Auth metadata. */
export {
  FREE_PLAN, PRO_PLAN, planEntitlements,
  type AccountPlan, type PlanEntitlements
} from '../../supabase/functions/pagecraft-db/plan-entitlements.ts';
