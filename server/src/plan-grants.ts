import type { PagecraftGateway } from './store-gateway.ts';
import type { AccountPlan, PaidPlan, PlanSource } from './plans.ts';

/* Server-side access to account levels. Every write goes through the database gateway, which
   recomputes `users.plan` from grants and subscriptions under the account row lock. Callers
   must already have checked that the acting identity may manage plans (the founder allowlist);
   nothing here trusts a browser-supplied plan. */

export interface PlanGrant {
  id: string;
  userId: string;
  plan: PaidPlan;
  reason: string;
  grantedBy: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface BillingSubscriptionSummary {
  id: string;
  environment: 'sandbox' | 'live';
  priceId: string;
  plan: PaidPlan;
  status: 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled';
  statusChangedAt: string | null;
  currentPeriodEnd: string | null;
  scheduledChange: 'cancel' | 'pause' | 'resume' | null;
}

export interface AccountPlanStatus {
  plan: AccountPlan;
  source: PlanSource;
  changedAt: string | null;
  grants: PlanGrant[];
  subscriptions: BillingSubscriptionSummary[];
}

export interface PlanRecomputeResult {
  plan: AccountPlan;
  source: PlanSource;
  changed: boolean;
}

export interface PlanGrantInput {
  userId: string;
  plan: PaidPlan;
  reason: string;
  grantedBy: string;
  expiresAt?: string | null;
}

export class GatewayPlanGrants {
  private gateway: PagecraftGateway;
  constructor(gateway: PagecraftGateway) { this.gateway = gateway; }

  status(userId: string) {
    return this.gateway.call<AccountPlanStatus>('plan.status', { userId });
  }

  recompute(userId: string) {
    return this.gateway.call<PlanRecomputeResult>('plan.recompute', { userId });
  }

  grant(input: PlanGrantInput) {
    return this.gateway.call<{ grant: PlanGrant; plan: PlanRecomputeResult }>('plan.grant', {
      userId: input.userId, plan: input.plan, reason: input.reason,
      grantedBy: input.grantedBy, expiresAt: input.expiresAt ?? null,
    });
  }

  revoke(grantId: string, revokedBy: string) {
    return this.gateway.call<{ revoked: boolean; plan: PlanRecomputeResult }>('plan.revokeGrant', {
      grantId, revokedBy,
    });
  }
}
